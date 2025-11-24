/**
 * Analysis Panel for Code Review
 * Displays AI-powered code analysis and explanation in a webview
 */

import * as vscode from 'vscode';
import { AnalysisService } from '../services/analysis-service.js';
import { AIProviderFactory } from '../services/providers/provider-factory.js';
import type { AIProviderType } from '../services/providers/ai-provider.interface.js';
import { CacheService } from '../services/cache-service.js';
import { computeSHA256 } from '../utils/hash.js';
import type { AnalysisResult, ExplainResult } from '../types/analysis.js';

type TabType = 'analysis' | 'explain';

export class AnalysisPanel {
  public static currentPanel: AnalysisPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];

  // Services
  private _analysisService: AnalysisService | null = null;
  private _cacheService: CacheService;

  // Current state
  private _currentFile: vscode.Uri | undefined;
  private _currentCode: string = '';
  private _currentHash: string = '';
  private _currentTab: TabType = 'analysis';
  private _analysisResult: AnalysisResult | null = null;
  private _explainResult: ExplainResult | null = null;
  private _isUpToDate: boolean = true;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;
    this._cacheService = new CacheService(context);

    // Initialize analysis service
    this._initializeAnalysisService();

    // Set initial HTML content
    this._updateWebview();

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'runAnalysis':
            await this._handleRunAnalysis();
            break;
          case 'runExplain':
            await this._handleRunExplain();
            break;
          case 'jumpToLine':
            await this._handleJumpToLine(message.line);
            break;
          case 'switchTab':
            this._currentTab = message.tab;
            this._updateWebview();
            break;
          case 'copyToClipboard':
            await this._handleCopyToClipboard(message.data);
            break;
          case 'error':
            vscode.window.showErrorMessage(message.text);
            break;
        }
      },
      null,
      this._disposables
    );

    // Clean up when panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  /**
   * Get current provider and model info from configuration (real-time)
   */
  private _getCurrentProviderInfo(): { provider: string; model: string } {
    try {
      const config = vscode.workspace.getConfiguration('gooseCodeReview');
      const providerType = config.get<AIProviderType>('aiProvider', 'openai');

      if (providerType === 'gemini') {
        const model = config.get<string>('geminiModel', 'gemini-2.5-flash');
        return { provider: 'Gemini', model };
      } else {
        const useCustomApi = config.get<boolean>('useCustomApi', false);
        const model = config.get<string>('analysisModel', 'gpt-4');
        const customModelName = config.get<string>('customModelName', '');

        if (useCustomApi) {
          const modelToUse = customModelName || model;
          return { provider: 'Custom OpenAI-compatible API', model: modelToUse };
        } else {
          return { provider: 'OpenAI', model };
        }
      }
    } catch (error) {
      return { provider: '', model: '' };
    }
  }

  /**
   * Initialize analysis service with API key from configuration
   */
  private async _initializeAnalysisService(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('gooseCodeReview');
      const providerType = config.get<AIProviderType>('aiProvider', 'openai');

      if (providerType === 'gemini') {
        // Initialize Gemini provider
        const geminiApiKey = await this._context.secrets.get('gemini-api-key') ||
                             config.get<string>('geminiApiKey', '');
        const geminiModel = config.get<string>('geminiModel', 'gemini-2.5-flash');

        if (!geminiApiKey) {
          vscode.window.showWarningMessage(
            'Gemini API key not configured. Please set it in the extension settings or use the secret storage.',
            'Configure'
          ).then(selection => {
            if (selection === 'Configure') {
              vscode.commands.executeCommand('workbench.action.openSettings', 'gooseCodeReview.geminiApiKey');
            }
          });
          return;
        }

        const provider = AIProviderFactory.create({
          provider: 'gemini',
          gemini: {
            apiKey: geminiApiKey,
            model: geminiModel,
            timeout: 60000,
          },
        });

        this._analysisService = new AnalysisService(provider);
      } else {
        // Initialize OpenAI provider
        const openaiApiKey = await this._context.secrets.get('openai-api-key') ||
                             config.get<string>('openaiApiKey', '');
        const model = config.get<string>('analysisModel', 'gpt-4');
        const useCustomApi = config.get<boolean>('useCustomApi', false);
        const customApiUrl = config.get<string>('customApiUrl', '');
        const customModelName = config.get<string>('customModelName', '');

        // Check if using custom API
        if (useCustomApi) {
          if (!customApiUrl) {
            vscode.window.showWarningMessage(
              'Custom API is enabled but no URL is configured. Please set the custom API URL in the extension settings.',
              'Configure'
            ).then(selection => {
              if (selection === 'Configure') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'gooseCodeReview.customApiUrl');
              }
            });
            return;
          }

          // Use custom model name if provided, otherwise fall back to analysisModel
          const modelToUse = customModelName || model;

          const provider = AIProviderFactory.create({
            provider: 'openai',
            openai: {
              apiKey: openaiApiKey || 'dummy-key', // Some custom APIs don't require API key
              model: modelToUse,
              timeout: 60000,
              baseURL: customApiUrl,
            },
          });

          this._analysisService = new AnalysisService(provider);
        } else {
          // Using official OpenAI API
          if (!openaiApiKey) {
            vscode.window.showWarningMessage(
              'OpenAI API key not configured. Please set it in the extension settings or use the secret storage.',
              'Configure'
            ).then(selection => {
              if (selection === 'Configure') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'gooseCodeReview.openaiApiKey');
              }
            });
            return;
          }

          const provider = AIProviderFactory.create({
            provider: 'openai',
            openai: {
              apiKey: openaiApiKey,
              model,
              timeout: 60000,
            },
          });

          this._analysisService = new AnalysisService(provider);
        }
      }
    } catch (error) {
      console.error('Failed to initialize analysis service:', error);
    }
  }

  /**
   * Create or show the analysis panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
    file?: vscode.Uri
  ): AnalysisPanel {
    const column = vscode.ViewColumn.Beside;

    // If we already have a panel, show it
    if (AnalysisPanel.currentPanel) {
      AnalysisPanel.currentPanel._panel.reveal(column);
      if (file) {
        AnalysisPanel.currentPanel.loadFile(file);
      }
      return AnalysisPanel.currentPanel;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      'gooseCodeReviewAnalysis',
      '🦆 Code Analysis',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    AnalysisPanel.currentPanel = new AnalysisPanel(panel, extensionUri, context);

    if (file) {
      AnalysisPanel.currentPanel.loadFile(file);
    }

    return AnalysisPanel.currentPanel;
  }

  /**
   * Load a file for analysis
   */
  public async loadFile(file: vscode.Uri): Promise<void> {
    this._currentFile = file;

    try {
      // Read file content
      const document = await vscode.workspace.openTextDocument(file);
      this._currentCode = document.getText();
      this._currentHash = computeSHA256(this._currentCode);

      // Check cache
      const cacheResult = await this._cacheService.check(file.fsPath, this._currentHash);

      if (cacheResult.hasCache && cacheResult.insight) {
        // Load from cache
        this._analysisResult = cacheResult.insight.analysis || null;
        this._explainResult = cacheResult.insight.explain || null;
        this._isUpToDate = cacheResult.hashMatched;
      } else {
        // No cache, reset state
        this._analysisResult = null;
        this._explainResult = null;
        this._isUpToDate = true;
      }

      this._updateWebview();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load file: ${error}`);
    }
  }

  /**
   * Handle run analysis request
   */
  private async _handleRunAnalysis(): Promise<void> {
    if (!this._currentFile || !this._analysisService) {
      return;
    }

    try {
      // Get current AI provider and model info (real-time from config)
      const { provider, model } = this._getCurrentProviderInfo();
      if (provider && model) {
        vscode.window.showInformationMessage(
          `🤖 Analyzing with ${provider}: ${model}`
        );
      }

      // Show loading state
      this._panel.webview.postMessage({ command: 'analysisLoading', isLoading: true });

      // Get language from file extension
      const document = await vscode.workspace.openTextDocument(this._currentFile);
      const language = document.languageId;

      // Run analysis
      const result = await this._analysisService.analyzeCode(this._currentCode, {
        language,
        filePath: this._currentFile.fsPath,
      });

      this._analysisResult = result;
      this._isUpToDate = true;

      // Save to cache
      await this._cacheService.saveAnalysis(this._currentFile.fsPath, this._currentHash, result);

      // Update webview with new results
      this._updateWebview();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Analysis failed: ${errorMessage}`);
      this._panel.webview.postMessage({ command: 'analysisLoading', isLoading: false });
    }
  }

  /**
   * Handle run explain request
   */
  private async _handleRunExplain(): Promise<void> {
    if (!this._currentFile || !this._analysisService) {
      return;
    }

    try {
      // Get current AI provider and model info (real-time from config)
      const { provider, model } = this._getCurrentProviderInfo();
      if (provider && model) {
        vscode.window.showInformationMessage(
          `🤖 Explaining with ${provider}: ${model}`
        );
      }

      // Show loading state
      this._panel.webview.postMessage({ command: 'explainLoading', isLoading: true });

      // Get language from file extension
      const document = await vscode.workspace.openTextDocument(this._currentFile);
      const language = document.languageId;

      // Run explain
      const result = await this._analysisService.explainCode(this._currentCode, {
        language,
        filePath: this._currentFile.fsPath,
      });

      this._explainResult = result;
      this._isUpToDate = true;

      // Save to cache
      await this._cacheService.saveExplain(this._currentFile.fsPath, this._currentHash, result);

      // Update webview with new results
      this._updateWebview();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Explanation failed: ${errorMessage}`);
      this._panel.webview.postMessage({ command: 'explainLoading', isLoading: false });
    }
  }

  /**
   * Handle jump to line request
   */
  private async _handleJumpToLine(line: number): Promise<void> {
    if (!this._currentFile) {
      return;
    }

    try {
      const document = await vscode.workspace.openTextDocument(this._currentFile);
      const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);

      const position = new vscode.Position(line - 1, 0);
      const range = new vscode.Range(position, position);

      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to jump to line: ${error}`);
    }
  }

  /**
   * Handle copy to clipboard request
   */
  private async _handleCopyToClipboard(data: unknown): Promise<void> {
    try {
      await vscode.env.clipboard.writeText(JSON.stringify(data, null, 2));
      vscode.window.showInformationMessage('Copied to clipboard');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy: ${error}`);
    }
  }

  /**
   * Update the webview content
   */
  private _updateWebview(): void {
    this._panel.webview.html = this._getWebviewContent();
  }

  /**
   * Dispose of the panel
   */
  public dispose(): void {
    AnalysisPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Get webview HTML content
   */
  private _getWebviewContent(): string {
    const nonce = this._getNonce();
    const fileName = this._currentFile
      ? vscode.workspace.asRelativePath(this._currentFile)
      : 'No file selected';

    const analysisResultJson = JSON.stringify(this._analysisResult);
    const explainResultJson = JSON.stringify(this._explainResult);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net;">
    <title>Goose Code Review - Analysis</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@vscode/codicons@0.0.35/dist/codicon.css">
    <style>
        ${this._getStyles()}
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <div class="header-row">
            <span class="file-path">${fileName}</span>
            ${!this._isUpToDate ? '<span class="badge badge-warning">Outdated</span>' : ''}
            ${this._isUpToDate && this._analysisResult ? '<span class="badge badge-success">Up-to-date</span>' : ''}
        </div>
        <div class="tabs">
            <button class="tab ${this._currentTab === 'analysis' ? 'active' : ''}" data-tab="analysis">
                <span class="codicon codicon-bug"></span> Analysis
            </button>
            <button class="tab ${this._currentTab === 'explain' ? 'active' : ''}" data-tab="explain">
                <span class="codicon codicon-book"></span> Explain
            </button>
        </div>
    </div>

    <!-- Content -->
    <div class="content">
        <!-- Analysis Tab -->
        <div class="tab-content ${this._currentTab === 'analysis' ? 'active' : ''}" id="analysisTab">
            ${this._getAnalysisTabContent()}
        </div>

        <!-- Explain Tab -->
        <div class="tab-content ${this._currentTab === 'explain' ? 'active' : ''}" id="explainTab">
            ${this._getExplainTabContent()}
        </div>
    </div>

    <script nonce="${nonce}">
        ${this._getJavaScript(analysisResultJson, explainResultJson)}
    </script>
</body>
</html>`;
  }

  /**
   * Get CSS styles
   */
  private _getStyles(): string {
    return `
        * {
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 0;
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        .header {
            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 12px;
            flex-shrink: 0;
        }

        .header-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .file-path {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-family: var(--vscode-editor-font-family);
        }

        .badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 600;
        }

        .badge-success {
            background-color: #28a745;
            color: white;
        }

        .badge-warning {
            background-color: #ffc107;
            color: #000;
        }

        .tabs {
            display: flex;
            gap: 4px;
        }

        .tab {
            background-color: transparent;
            color: var(--vscode-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px 3px 0 0;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: background-color 0.2s;
        }

        .tab:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .tab.active {
            background-color: var(--vscode-editor-background);
            border-bottom: 2px solid var(--vscode-focusBorder);
        }

        .content {
            flex: 1;
            overflow: hidden;
            position: relative;
        }

        .tab-content {
            display: none;
            height: 100%;
            overflow-y: auto;
            padding: 16px;
        }

        .tab-content.active {
            display: block;
            animation: fadeIn 0.2s ease-in-out;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--vscode-descriptionForeground);
            gap: 16px;
        }

        .empty-state-icon {
            font-size: 48px;
            opacity: 0.5;
        }

        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
        }

        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .btn:active {
            transform: translateY(0);
            box-shadow: none;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            flex-direction: column;
            gap: 16px;
            animation: fadeIn 0.3s ease-in-out;
        }

        .loading p {
            animation: pulse 2s ease-in-out infinite;
        }

        .spinner {
            width: 48px;
            height: 48px;
            position: relative;
        }

        .spinner::before,
        .spinner::after {
            content: '';
            position: absolute;
            border-radius: 50%;
        }

        .spinner::before {
            width: 48px;
            height: 48px;
            border: 4px solid var(--vscode-progressBar-background);
            border-top-color: var(--vscode-button-background);
            border-right-color: var(--vscode-button-background);
            animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
        }

        .spinner::after {
            width: 32px;
            height: 32px;
            top: 8px;
            left: 8px;
            border: 3px solid transparent;
            border-top-color: var(--vscode-focusBorder);
            animation: spin 0.6s linear infinite reverse;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.7;
            }
        }

        .summary {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 16px;
        }

        .summary h3 {
            margin: 0 0 8px 0;
            font-size: 14px;
        }

        .issue {
            background-color: var(--vscode-sideBar-background);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 8px;
            border-left: 3px solid;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .issue:hover {
            transform: translateX(2px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }

        .issue.critical { border-left-color: #dc3545; }
        .issue.high { border-left-color: #fd7e14; }
        .issue.medium { border-left-color: #ffc107; }
        .issue.low { border-left-color: #6c757d; }
        .issue.info { border-left-color: #17a2b8; }

        .issue-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            cursor: pointer;
        }

        .severity-badge {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .issue-message {
            flex: 1;
            font-size: 13px;
        }

        .line-number {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            cursor: pointer;
            text-decoration: underline;
        }

        .line-number:hover {
            color: var(--vscode-textLink-foreground);
        }

        .issue-details {
            display: none;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .issue-details.expanded {
            display: block;
        }

        .code-example {
            margin-top: 8px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }

        .code-example pre {
            background-color: var(--vscode-editor-background);
            padding: 8px;
            border-radius: 3px;
            overflow-x: auto;
        }

        .section {
            margin-bottom: 24px;
        }

        .section h3 {
            font-size: 16px;
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .component-card {
            background-color: var(--vscode-sideBar-background);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 8px;
        }

        .component-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .component-type {
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .component-icon {
            font-size: 16px;
            margin-right: 4px;
        }

        .component-icon.class { color: #f1c40f; }
        .component-icon.function { color: #9b59b6; }
        .component-icon.module { color: #3498db; }
        .component-icon.interface { color: #e74c3c; }
        .component-icon.constant { color: #1abc9c; }
        .component-icon.type { color: #e67e22; }
        .component-icon.variable { color: #95a5a6; }

        .dependency-list {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 12px;
            border-radius: 4px;
            margin-top: 8px;
        }

        .dependency-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 0;
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
        }

        .dependency-arrow {
            color: var(--vscode-focusBorder);
            font-weight: bold;
        }

        .dependency-method-wrapper {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .dependency-caller,
        .dependency-callee {
            font-family: 'Courier New', monospace;
            background-color: var(--vscode-editor-background);
            padding: 2px 6px;
            border-radius: 3px;
        }

        .dependency-line-number {
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            cursor: pointer;
            text-decoration: none;
            padding: 2px 4px;
            border-radius: 2px;
            transition: all 0.2s ease;
        }

        .dependency-line-number:hover {
            color: var(--vscode-textLink-foreground);
            background-color: var(--vscode-list-hoverBackground);
            text-decoration: underline;
        }

        .dependency-description {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .step-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 50%;
            font-weight: bold;
            font-size: 12px;
            margin-right: 8px;
        }

        .feature-item {
            display: flex;
            align-items: start;
            gap: 8px;
            margin-bottom: 12px;
        }

        .feature-icon {
            color: var(--vscode-testing-iconPassed);
            margin-top: 2px;
        }

        ul {
            padding-left: 20px;
        }

        li {
            margin-bottom: 8px;
        }
    `;
  }

  /**
   * Get Analysis tab content
   */
  private _getAnalysisTabContent(): string {
    if (!this._analysisResult) {
      return `
        <div class="empty-state">
            <span class="codicon codicon-bug empty-state-icon"></span>
            <p>No analysis results yet</p>
            <button class="btn" data-action="runAnalysis">
                <span class="codicon codicon-play"></span>
                Run Analysis
            </button>
        </div>
      `;
    }

    const issuesHtml = this._analysisResult.issues.map((issue, index) => `
      <div class="issue ${issue.severity}">
        <div class="issue-header" data-action="toggleIssue" data-index="${index}">
          <span class="severity-badge">${issue.severity}</span>
          <span class="issue-message">${this._escapeHtml(issue.message)}</span>
          <span class="line-number" data-action="jumpToLine" data-line="${issue.line}">Line ${issue.line}</span>
        </div>
        <div class="issue-details" id="issue-${index}">
          <p><strong>Suggestion:</strong> ${this._escapeHtml(issue.suggestion)}</p>
          ${issue.codeExample ? `
            <div class="code-example">
              <p><strong>Before:</strong></p>
              <pre>${this._escapeHtml(issue.codeExample.before)}</pre>
              <p><strong>After:</strong></p>
              <pre>${this._escapeHtml(issue.codeExample.after)}</pre>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="summary">
        <h3>Summary</h3>
        <p>${this._escapeHtml(this._analysisResult.summary)}</p>
      </div>
      <div class="section">
        <h3>
          <span class="codicon codicon-issues"></span>
          Issues (${this._analysisResult.issues.length})
        </h3>
        ${issuesHtml || '<p>No issues found</p>'}
      </div>
      <button class="btn" data-action="runAnalysis">
        <span class="codicon codicon-refresh"></span>
        Re-analyze
      </button>
    `;
  }

  /**
   * Get icon for component type
   */
  private _getComponentIcon(type: string): string {
    const iconMap: Record<string, string> = {
      'class': 'symbol-class',
      'function': 'symbol-method',
      'module': 'symbol-namespace',
      'interface': 'symbol-interface',
      'constant': 'symbol-constant',
      'type': 'symbol-type-parameter',
      'variable': 'symbol-variable',
    };
    return iconMap[type] || 'symbol-misc';
  }

  /**
   * Get Explain tab content
   */
  private _getExplainTabContent(): string {
    if (!this._explainResult) {
      return `
        <div class="empty-state">
            <span class="codicon codicon-book empty-state-icon"></span>
            <p>No explanation yet</p>
            <button class="btn" data-action="runExplain">
                <span class="codicon codicon-play"></span>
                Generate Explanation
            </button>
        </div>
      `;
    }

    const result = this._explainResult;

    return `
      <div class="section">
        <h3><span class="codicon codicon-info"></span> Overview</h3>
        <p>${this._escapeHtml(result.overview)}</p>
      </div>

      ${result.mainComponents && result.mainComponents.length > 0 ? `
        <div class="section">
          <h3><span class="codicon codicon-symbol-class"></span> Main Components (${result.mainComponents.length})</h3>
          ${result.mainComponents.map(comp => `
            <div class="component-card">
              <div class="component-header">
                <span class="codicon codicon-${this._getComponentIcon(comp.type)} component-icon ${comp.type}"></span>
                <span class="component-type">${comp.type}</span>
                <strong>${this._escapeHtml(comp.name)}</strong>
                ${comp.line ? `<span class="line-number" data-action="jumpToLine" data-line="${comp.line}">Line ${comp.line}</span>` : ''}
              </div>
              <p>${this._escapeHtml(comp.description)}</p>
              ${comp.codeSnippet ? `<pre><code>${this._escapeHtml(comp.codeSnippet)}</code></pre>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${result.methodDependencies && result.methodDependencies.length > 0 ? `
        <div class="section">
          <h3><span class="codicon codicon-type-hierarchy"></span> Method Dependencies (${result.methodDependencies.length})</h3>
          <div class="dependency-list">
            ${result.methodDependencies.map(dep => `
              <div class="dependency-item">
                <span class="dependency-method-wrapper">
                  <span class="dependency-caller">${this._escapeHtml(dep.caller)}</span>
                  ${dep.callerLine ? `<span class="dependency-line-number" data-action="jumpToLine" data-line="${dep.callerLine}" title="Jump to line ${dep.callerLine}">:${dep.callerLine}</span>` : ''}
                </span>
                <span class="dependency-arrow codicon codicon-arrow-right"></span>
                <span class="dependency-method-wrapper">
                  <span class="dependency-callee">${this._escapeHtml(dep.callee)}</span>
                  ${dep.calleeLine ? `<span class="dependency-line-number" data-action="jumpToLine" data-line="${dep.calleeLine}" title="Jump to line ${dep.calleeLine}">:${dep.calleeLine}</span>` : ''}
                </span>
                ${dep.description ? `<span class="dependency-description">${this._escapeHtml(dep.description)}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${result.howItWorks && result.howItWorks.length > 0 ? `
        <div class="section">
          <h3><span class="codicon codicon-list-ordered"></span> How It Works</h3>
          ${result.howItWorks.map(step => `
            <div class="component-card">
              <div class="component-header">
                <span class="step-number">${step.step}</span>
                <strong>${this._escapeHtml(step.title)}</strong>
                ${step.line ? `<span class="line-number" data-action="jumpToLine" data-line="${step.line}">Line ${step.line}</span>` : ''}
              </div>
              <p>${this._escapeHtml(step.description)}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${result.notableFeatures && result.notableFeatures.length > 0 ? `
        <div class="section">
          <h3><span class="codicon codicon-star"></span> Notable Features (${result.notableFeatures.length})</h3>
          ${result.notableFeatures.map(feature => `
            <div class="feature-item">
              <span class="codicon codicon-check feature-icon"></span>
              <span>${this._escapeHtml(feature)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <button class="btn" data-action="runExplain">
        <span class="codicon codicon-refresh"></span>
        Re-generate
      </button>
    `;
  }

  /**
   * Get JavaScript code
   */
  private _getJavaScript(analysisResultJson: string, explainResultJson: string): string {
    return `
      const vscode = acquireVsCodeApi();
      let analysisResult = ${analysisResultJson};
      let explainResult = ${explainResultJson};

      // Tab switching
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = tab.dataset.tab;
          vscode.postMessage({ command: 'switchTab', tab: tabName });
        });
      });

      // Helper function to show loading state
      function showLoading(tabId, message = 'Analyzing...') {
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
          tabContent.innerHTML = \`
            <div class="loading">
              <div class="spinner"></div>
              <p>\${message}</p>
            </div>
          \`;
        }
      }

      // Event delegation for all click events
      document.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;

        switch (action) {
          case 'runAnalysis':
            showLoading('analysisTab', 'Analyzing code... This may take a moment.');
            vscode.postMessage({ command: 'runAnalysis' });
            break;

          case 'runExplain':
            showLoading('explainTab', 'Generating explanation... This may take a moment.');
            vscode.postMessage({ command: 'runExplain' });
            break;

          case 'jumpToLine':
            event.stopPropagation();
            const line = parseInt(target.dataset.line, 10);
            if (!isNaN(line)) {
              vscode.postMessage({ command: 'jumpToLine', line });
            }
            break;

          case 'toggleIssue':
            const index = target.dataset.index;
            const details = document.getElementById('issue-' + index);
            if (details) {
              details.classList.toggle('expanded');
            }
            break;
        }
      });

      // Handle messages from extension
      // Note: analysisResult and explainResult are now handled by full webview refresh
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
          case 'analysisLoading':
            if (message.isLoading) {
              showLoading('analysisTab', 'Analyzing code... This may take a moment.');
            }
            break;
          case 'explainLoading':
            if (message.isLoading) {
              showLoading('explainTab', 'Generating explanation... This may take a moment.');
            }
            break;
        }
      });
    `;
  }

  /**
   * Get a random nonce for CSP
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private _escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
