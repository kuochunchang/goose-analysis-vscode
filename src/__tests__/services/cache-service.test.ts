import { describe, it, expect, beforeEach } from 'vitest';
import { CacheService } from '../../services/cache-service.js';
import { createMockExtensionContext } from '../mocks/vscode-mock.js';
import type { AnalysisResult, ExplainResult, CachedInsight } from '../../types/analysis.js';

describe('CacheService', () => {
  let context: ReturnType<typeof createMockExtensionContext>;
  let cacheService: CacheService;

  beforeEach(() => {
    context = createMockExtensionContext();
    cacheService = new CacheService(context as any);
  });

  describe('check', () => {
    it('should return hasCache false when no cache exists', async () => {
      const result = cacheService.check('/test/file.ts', 'hash123');

      expect(result.hasCache).toBe(false);
      expect(result.hashMatched).toBe(false);
      expect(result.insight).toBeNull();
    });

    it('should return hasCache true and hashMatched true when exact hash match exists', async () => {
      const filePath = '/test/file.ts';
      const hash = 'hash123';
      const insight: CachedInsight = {
        filePath,
        codeHash: hash,
        analysis: {
          issues: [],
          summary: 'Test',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      await context.workspaceState.update(`goose:insight:${filePath}:${hash}`, insight);

      const result = await cacheService.check(filePath, hash);

      expect(result.hasCache).toBe(true);
      expect(result.hashMatched).toBe(true);
      expect(result.insight).toEqual(insight);
    });

    it('should return hasCache true and hashMatched false when different hash exists', async () => {
      const filePath = '/test/file.ts';
      const oldHash = 'hash123';
      const newHash = 'hash456';
      const insight: CachedInsight = {
        filePath,
        codeHash: oldHash,
        analysis: {
          issues: [],
          summary: 'Test',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      await context.workspaceState.update(`goose:insight:${filePath}:${oldHash}`, insight);

      const result = await cacheService.check(filePath, newHash);

      expect(result.hasCache).toBe(true);
      expect(result.hashMatched).toBe(false);
      expect(result.insight).toEqual(insight);
    });

    it('should find cache with different hash for same file', async () => {
      const filePath = '/test/file.ts';
      const oldHash = 'hash123';
      const newHash = 'hash456';
      const insight: CachedInsight = {
        filePath,
        codeHash: oldHash,
        analysis: {
          issues: [],
          summary: 'Test',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      await context.workspaceState.update(`goose:insight:${filePath}:${oldHash}`, insight);

      const result = await cacheService.check(filePath, newHash);

      expect(result.hasCache).toBe(true);
      expect(result.hashMatched).toBe(false);
    });
  });

  describe('saveAnalysis', () => {
    it('should save analysis result to cache', async () => {
      const filePath = '/test/file.ts';
      const hash = 'hash123';
      const analysis: AnalysisResult = {
        issues: [],
        summary: 'Test analysis',
        timestamp: new Date().toISOString(),
      };

      await cacheService.saveAnalysis(filePath, hash, analysis);

      const result = await cacheService.check(filePath, hash);
      expect(result.hasCache).toBe(true);
      expect(result.hashMatched).toBe(true);
      expect(result.insight?.analysis).toEqual(analysis);
      expect(result.insight?.filePath).toBe(filePath);
      expect(result.insight?.codeHash).toBe(hash);
    });

    it('should preserve existing explain when saving analysis', async () => {
      const filePath = '/test/file.ts';
      const hash = 'hash123';
      const existingExplain: ExplainResult = {
        overview: 'Existing explain',
        mainComponents: [],
        howItWorks: [],
        keyConcepts: [],
        dependencies: [],
        notableFeatures: [],
        timestamp: new Date().toISOString(),
      };

      // Save explain first
      await cacheService.saveExplain(filePath, hash, existingExplain);

      // Then save analysis
      const analysis: AnalysisResult = {
        issues: [],
        summary: 'Test analysis',
        timestamp: new Date().toISOString(),
      };
      await cacheService.saveAnalysis(filePath, hash, analysis);

      const result = await cacheService.check(filePath, hash);
      expect(result.insight?.analysis).toEqual(analysis);
      expect(result.insight?.explain).toEqual(existingExplain);
    });

    it('should cleanup old cache entries for same file', async () => {
      const filePath = '/test/file.ts';
      const oldHash = 'hash123';
      const newHash = 'hash456';

      // Save with old hash
      await cacheService.saveAnalysis(filePath, oldHash, {
        issues: [],
        summary: 'Old',
        timestamp: new Date().toISOString(),
      });

      // Save with new hash
      await cacheService.saveAnalysis(filePath, newHash, {
        issues: [],
        summary: 'New',
        timestamp: new Date().toISOString(),
      });

      // Old cache should be cleaned up (exact hash match should not exist)
      const oldResult = await cacheService.check(filePath, oldHash);
      expect(oldResult.hashMatched).toBe(false);
      // But check might still find the new cache with different hash
      // So we verify the old hash is not in the cache keys
      const allKeys = context.workspaceState.keys();
      const oldKey = `goose:insight:${filePath}:${oldHash}`;
      expect(allKeys).not.toContain(oldKey);

      // New cache should exist
      const newResult = await cacheService.check(filePath, newHash);
      expect(newResult.hasCache).toBe(true);
      expect(newResult.hashMatched).toBe(true);
    });
  });

  describe('saveExplain', () => {
    it('should save explain result to cache', async () => {
      const filePath = '/test/file.ts';
      const hash = 'hash123';
      const explain: ExplainResult = {
        overview: 'Test explain',
        mainComponents: [],
        howItWorks: [],
        keyConcepts: [],
        dependencies: [],
        notableFeatures: [],
        timestamp: new Date().toISOString(),
      };

      await cacheService.saveExplain(filePath, hash, explain);

      const result = await cacheService.check(filePath, hash);
      expect(result.hasCache).toBe(true);
      expect(result.hashMatched).toBe(true);
      expect(result.insight?.explain).toEqual(explain);
    });

    it('should preserve existing analysis when saving explain', async () => {
      const filePath = '/test/file.ts';
      const hash = 'hash123';
      const existingAnalysis: AnalysisResult = {
        issues: [],
        summary: 'Existing analysis',
        timestamp: new Date().toISOString(),
      };

      // Save analysis first
      await cacheService.saveAnalysis(filePath, hash, existingAnalysis);

      // Then save explain
      const explain: ExplainResult = {
        overview: 'Test explain',
        mainComponents: [],
        howItWorks: [],
        keyConcepts: [],
        dependencies: [],
        notableFeatures: [],
        timestamp: new Date().toISOString(),
      };
      await cacheService.saveExplain(filePath, hash, explain);

      const result = await cacheService.check(filePath, hash);
      expect(result.insight?.explain).toEqual(explain);
      expect(result.insight?.analysis).toEqual(existingAnalysis);
    });
  });

  describe('clearAll', () => {
    it('should clear all cache entries', async () => {
      const filePath1 = '/test/file1.ts';
      const filePath2 = '/test/file2.ts';
      const hash1 = 'hash1';
      const hash2 = 'hash2';

      await cacheService.saveAnalysis(filePath1, hash1, {
        issues: [],
        summary: 'Test 1',
        timestamp: new Date().toISOString(),
      });

      await cacheService.saveAnalysis(filePath2, hash2, {
        issues: [],
        summary: 'Test 2',
        timestamp: new Date().toISOString(),
      });

      await cacheService.clearAll();

      const result1 = await cacheService.check(filePath1, hash1);
      const result2 = await cacheService.check(filePath2, hash2);

      expect(result1.hasCache).toBe(false);
      expect(result2.hasCache).toBe(false);
    });

    it('should not affect non-cache entries', async () => {
      const context = createMockExtensionContext();
      const cacheService = new CacheService(context as any);

      // Add a non-cache entry
      await context.workspaceState.update('other:key', 'value');

      // Add cache entry
      await cacheService.saveAnalysis('/test/file.ts', 'hash', {
        issues: [],
        summary: 'Test',
        timestamp: new Date().toISOString(),
      });

      await cacheService.clearAll();

      // Cache should be cleared
      const cacheResult = await cacheService.check('/test/file.ts', 'hash');
      expect(cacheResult.hasCache).toBe(false);

      // Other entry should remain
      const otherValue = context.workspaceState.get('other:key');
      expect(otherValue).toBe('value');
    });
  });
});
