import * as vscode from 'vscode';
import type { AnalysisResult, ExplainResult, CachedInsight } from '../types/analysis.js';

/**
 * Cache service using VS Code Workspace State
 * Stores analysis and explain results for quick retrieval
 */
export class CacheService {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Generate cache key for a file
   */
  private getCacheKey(filePath: string, hash: string): string {
    return `goose:insight:${filePath}:${hash}`;
  }

  /**
   * Check if cached insight exists for a file
   * @param filePath - The file path
   * @param hash - The current code hash
   * @returns Object with hasCache, hashMatched, and cached data
   */
  async check(
    filePath: string,
    hash: string
  ): Promise<{ hasCache: boolean; hashMatched: boolean; insight: CachedInsight | null }> {
    // Try to find cache with exact hash match
    const exactKey = this.getCacheKey(filePath, hash);
    const exactCache = this.context.workspaceState.get<CachedInsight>(exactKey);

    if (exactCache) {
      return {
        hasCache: true,
        hashMatched: true,
        insight: exactCache,
      };
    }

    // Try to find any cache for this file (with different hash)
    const allKeys = this.context.workspaceState.keys();
    const filePrefix = `goose:insight:${filePath}:`;
    const matchingKey = allKeys.find((key) => key.startsWith(filePrefix));

    if (matchingKey) {
      const outdatedCache = this.context.workspaceState.get<CachedInsight>(matchingKey);
      if (outdatedCache) {
        return {
          hasCache: true,
          hashMatched: false,
          insight: outdatedCache,
        };
      }
    }

    return {
      hasCache: false,
      hashMatched: false,
      insight: null,
    };
  }

  /**
   * Save analysis result to cache
   */
  async saveAnalysis(
    filePath: string,
    hash: string,
    analysis: AnalysisResult
  ): Promise<void> {
    const key = this.getCacheKey(filePath, hash);
    const existing = this.context.workspaceState.get<CachedInsight>(key);

    const insight: CachedInsight = {
      filePath,
      codeHash: hash,
      analysis,
      explain: existing?.explain,
      timestamp: new Date().toISOString(),
    };

    await this.context.workspaceState.update(key, insight);

    // Clean up old cache entries for this file
    await this.cleanupOldCache(filePath, hash);
  }

  /**
   * Save explain result to cache
   */
  async saveExplain(filePath: string, hash: string, explain: ExplainResult): Promise<void> {
    const key = this.getCacheKey(filePath, hash);
    const existing = this.context.workspaceState.get<CachedInsight>(key);

    const insight: CachedInsight = {
      filePath,
      codeHash: hash,
      analysis: existing?.analysis,
      explain,
      timestamp: new Date().toISOString(),
    };

    await this.context.workspaceState.update(key, insight);

    // Clean up old cache entries for this file
    await this.cleanupOldCache(filePath, hash);
  }

  /**
   * Clean up old cache entries for a file (keep only the latest)
   */
  private async cleanupOldCache(filePath: string, currentHash: string): Promise<void> {
    const allKeys = this.context.workspaceState.keys();
    const filePrefix = `goose:insight:${filePath}:`;
    const currentKey = this.getCacheKey(filePath, currentHash);

    const keysToDelete = allKeys.filter(
      (key) => key.startsWith(filePrefix) && key !== currentKey
    );

    for (const key of keysToDelete) {
      await this.context.workspaceState.update(key, undefined);
    }
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    const allKeys = this.context.workspaceState.keys();
    const insightKeys = allKeys.filter((key) => key.startsWith('goose:insight:'));

    for (const key of insightKeys) {
      await this.context.workspaceState.update(key, undefined);
    }
  }
}
