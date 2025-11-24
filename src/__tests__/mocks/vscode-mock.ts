import type * as vscode from 'vscode';

/**
 * Mock VS Code Extension Context
 */
export function createMockExtensionContext(): vscode.ExtensionContext {
  const workspaceState = new Map<string, any>();
  const globalState = new Map<string, any>();
  const secrets = new Map<string, string>();

  return {
    subscriptions: [],
    workspaceState: {
      get: (key: string) => workspaceState.get(key),
      update: async (key: string, value: any) => {
        if (value === undefined) {
          workspaceState.delete(key);
        } else {
          workspaceState.set(key, value);
        }
        return Promise.resolve();
      },
      keys: () => Array.from(workspaceState.keys()),
    },
    globalState: {
      get: (key: string) => globalState.get(key),
      update: async (key: string, value: any) => {
        if (value === undefined) {
          globalState.delete(key);
        } else {
          globalState.set(key, value);
        }
        return Promise.resolve();
      },
      keys: () => Array.from(globalState.keys()),
    },
    secrets: {
      get: async (key: string) => secrets.get(key) || undefined,
      store: async (key: string, value: string) => {
        secrets.set(key, value);
      },
      delete: async (key: string) => {
        secrets.delete(key);
      },
    },
    extensionUri: {
      scheme: 'file',
      authority: '',
      path: '/test-extension',
      fsPath: '/test-extension',
      query: '',
      fragment: '',
      with: () => ({}) as vscode.Uri,
      toJSON: () => ({}),
    } as vscode.Uri,
    extensionPath: '/test-extension',
    globalStorageUri: {} as vscode.Uri,
    logUri: {} as vscode.Uri,
    storageUri: {} as vscode.Uri,
    globalStoragePath: '/test-global-storage',
    logPath: '/test-log',
    storagePath: '/test-storage',
    extensionMode: 1 as vscode.ExtensionMode,
    extension: {} as vscode.Extension<any>,
    environmentVariableCollection: {} as vscode.EnvironmentVariableCollection,
    asAbsolutePath: (relativePath: string) => `/test-extension/${relativePath}`,
    languageModelAccessInformation: {} as any,
  } as unknown as vscode.ExtensionContext;
}

/**
 * Mock VS Code Configuration
 */
export function createMockConfiguration(values: Record<string, any> = {}) {
  return {
    get: <T>(key: string, defaultValue?: T): T => {
      const keys = key.split('.');
      let value: any = values;
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) break;
      }
      return (value !== undefined ? value : defaultValue) as T;
    },
    has: (key: string) => {
      const keys = key.split('.');
      let value: any = values;
      for (const k of keys) {
        value = value?.[k];
        if (value === undefined) return false;
      }
      return true;
    },
    inspect: () => undefined,
    update: async () => {},
  };
}
