import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisService } from '../../services/analysis-service.js';
import type {
  IAIProvider,
  AnalysisOptions,
  AnalysisResult,
  ExplainResult,
} from '../../types/analysis.js';

describe('AnalysisService', () => {
  let mockProvider: IAIProvider;
  let service: AnalysisService;

  beforeEach(() => {
    mockProvider = {
      analyzeCode: vi.fn(),
      explainCode: vi.fn(),
    };
    service = new AnalysisService(mockProvider);
  });

  describe('constructor', () => {
    it('should create service with provider', () => {
      const provider = { analyzeCode: vi.fn(), explainCode: vi.fn() };
      const service = new AnalysisService(provider);
      expect(service).toBeInstanceOf(AnalysisService);
    });
  });

  describe('analyzeCode', () => {
    it('should delegate to provider analyzeCode', async () => {
      const code = 'const x = 1;';
      const options: AnalysisOptions = { language: 'typescript' };
      const expectedResult: AnalysisResult = {
        issues: [],
        summary: 'No issues found',
        timestamp: new Date().toISOString(),
      };

      vi.mocked(mockProvider.analyzeCode).mockResolvedValue(expectedResult);

      const result = await service.analyzeCode(code, options);

      expect(mockProvider.analyzeCode).toHaveBeenCalledWith(code, options);
      expect(result).toEqual(expectedResult);
    });

    it('should use default empty options when not provided', async () => {
      const code = 'const x = 1;';
      const expectedResult: AnalysisResult = {
        issues: [],
        summary: 'No issues found',
        timestamp: new Date().toISOString(),
      };

      vi.mocked(mockProvider.analyzeCode).mockResolvedValue(expectedResult);

      await service.analyzeCode(code);

      expect(mockProvider.analyzeCode).toHaveBeenCalledWith(code, {});
    });

    it('should propagate errors from provider', async () => {
      const code = 'const x = 1;';
      const error = new Error('Provider error');

      vi.mocked(mockProvider.analyzeCode).mockRejectedValue(error);

      await expect(service.analyzeCode(code)).rejects.toThrow('Provider error');
    });
  });

  describe('explainCode', () => {
    it('should delegate to provider explainCode', async () => {
      const code = 'const x = 1;';
      const options: AnalysisOptions = { language: 'typescript' };
      const expectedResult: ExplainResult = {
        overview: 'Simple variable declaration',
        mainComponents: [],
        howItWorks: [],
        keyConcepts: [],
        dependencies: [],
        notableFeatures: [],
        timestamp: new Date().toISOString(),
      };

      vi.mocked(mockProvider.explainCode).mockResolvedValue(expectedResult);

      const result = await service.explainCode(code, options);

      expect(mockProvider.explainCode).toHaveBeenCalledWith(code, options);
      expect(result).toEqual(expectedResult);
    });

    it('should use default empty options when not provided', async () => {
      const code = 'const x = 1;';
      const expectedResult: ExplainResult = {
        overview: 'Simple variable declaration',
        mainComponents: [],
        howItWorks: [],
        keyConcepts: [],
        dependencies: [],
        notableFeatures: [],
        timestamp: new Date().toISOString(),
      };

      vi.mocked(mockProvider.explainCode).mockResolvedValue(expectedResult);

      await service.explainCode(code);

      expect(mockProvider.explainCode).toHaveBeenCalledWith(code, {});
    });

    it('should propagate errors from provider', async () => {
      const code = 'const x = 1;';
      const error = new Error('Provider error');

      vi.mocked(mockProvider.explainCode).mockRejectedValue(error);

      await expect(service.explainCode(code)).rejects.toThrow('Provider error');
    });
  });
});
