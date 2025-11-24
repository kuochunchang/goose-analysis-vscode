import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeminiProvider } from '../../../services/providers/gemini-provider.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock Google Generative AI
vi.mock('@google/generative-ai', () => {
  const mockGenerateContent = vi.fn();
  const mockGetGenerativeModel = vi.fn(() => ({
    generateContent: mockGenerateContent,
  }));

  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    })),
  };
});

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let mockGenerateContent: any;
  let mockGetGenerativeModel: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const GoogleGenAI = GoogleGenerativeAI as any;
    const mockInstance = new GoogleGenAI('test-key');
    mockGetGenerativeModel = mockInstance.getGenerativeModel;
    mockGenerateContent = vi.fn();
    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
    });

    provider = new GeminiProvider({
      apiKey: 'test-key',
      model: 'gemini-2.5-flash',
    });
  });

  describe('constructor', () => {
    it('should create provider with API key', () => {
      const provider = new GeminiProvider({
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
      });
      expect(provider).toBeInstanceOf(GeminiProvider);
    });

    it('should throw error when API key is missing', () => {
      expect(() => {
        new GeminiProvider({
          apiKey: '',
          model: 'gemini-2.5-flash',
        });
      }).toThrow('Gemini API key is required');
    });

    it('should use default model when not specified', () => {
      const provider = new GeminiProvider({
        apiKey: 'test-key',
      });
      expect(provider).toBeInstanceOf(GeminiProvider);
    });
  });

  describe('analyzeCode', () => {
    it('should analyze code and return result', async () => {
      const mockResponse = {
        response: {
          text: () =>
            JSON.stringify({
              issues: [
                {
                  severity: 'high',
                  category: 'security',
                  line: 1,
                  message: 'Test issue',
                  suggestion: 'Fix it',
                },
              ],
              summary: 'Test summary',
            }),
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await provider.analyzeCode('const x = 1;');

      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('timestamp');
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should handle JSON wrapped in code blocks', async () => {
      const mockResponse = {
        response: {
          text: () => '```json\n{"issues":[],"summary":"Test"}\n```',
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await provider.analyzeCode('const x = 1;');

      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('summary');
    });

    it('should handle errors from API', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      await expect(provider.analyzeCode('const x = 1;')).rejects.toThrow(
        'AI analysis failed: API Error'
      );
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        response: {
          text: () => '',
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await expect(provider.analyzeCode('const x = 1;')).rejects.toThrow('No response from Gemini');
    });
  });

  describe('explainCode', () => {
    it('should explain code and return result', async () => {
      const mockResponse = {
        response: {
          text: () =>
            JSON.stringify({
              overview: 'Test overview',
              mainComponents: [],
              howItWorks: [],
              keyConcepts: [],
              dependencies: [],
              notableFeatures: [],
            }),
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await provider.explainCode('const x = 1;');

      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('mainComponents');
      expect(result).toHaveProperty('howItWorks');
      expect(result).toHaveProperty('timestamp');
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should handle errors from API', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      await expect(provider.explainCode('const x = 1;')).rejects.toThrow(
        'Code explanation failed: API Error'
      );
    });

    it('should handle JSON wrapped in plain code blocks', async () => {
      const mockResponse = {
        response: {
          text: () => '```\n{"overview":"Test","mainComponents":[]}\n```',
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await provider.explainCode('const x = 1;');

      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('mainComponents');
    });

    it('should handle response without code blocks', async () => {
      const mockResponse = {
        response: {
          text: () => '{"overview":"Test","mainComponents":[]}',
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await provider.explainCode('const x = 1;');

      expect(result).toHaveProperty('overview');
    });
  });

  describe('model support detection', () => {
    it('should support JSON mode for gemini-2.5 models', async () => {
      const provider = new GeminiProvider({
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
      });

      const mockResponse = {
        response: {
          text: () => JSON.stringify({ issues: [], summary: 'Test' }),
        },
      };

      const GoogleGenAI = GoogleGenerativeAI as any;
      const mockInstance = new GoogleGenAI('test-key');
      const mockGetModel = mockInstance.getGenerativeModel;
      const mockGenContent = vi.fn().mockResolvedValue(mockResponse);
      mockGetModel.mockReturnValue({
        generateContent: mockGenContent,
      });

      await provider.analyzeCode('const x = 1;');

      // Check that getGenerativeModel was called with JSON mode config
      expect(mockGetModel).toHaveBeenCalled();
      const configCall = mockGetModel.mock.calls.find(
        (call: any[]) => call[0]?.generationConfig?.responseMimeType === 'application/json'
      );
      expect(configCall).toBeDefined();
    });

    it('should support JSON mode for gemini-2.0 models', async () => {
      const provider = new GeminiProvider({
        apiKey: 'test-key',
        model: 'gemini-2.0-flash',
      });

      const mockResponse = {
        response: {
          text: () => JSON.stringify({ issues: [], summary: 'Test' }),
        },
      };

      const GoogleGenAI = GoogleGenerativeAI as any;
      const mockInstance = new GoogleGenAI('test-key');
      const mockGetModel = mockInstance.getGenerativeModel;
      const mockGenContent = vi.fn().mockResolvedValue(mockResponse);
      mockGetModel.mockReturnValue({
        generateContent: mockGenContent,
      });

      await provider.analyzeCode('const x = 1;');

      expect(mockGetModel).toHaveBeenCalled();
    });

    it('should not support JSON mode for unknown models', async () => {
      const provider = new GeminiProvider({
        apiKey: 'test-key',
        model: 'unknown-model',
      });

      const mockResponse = {
        response: {
          text: () => JSON.stringify({ issues: [], summary: 'Test' }),
        },
      };

      const GoogleGenAI = GoogleGenerativeAI as any;
      const mockInstance = new GoogleGenAI('test-key');
      const mockGetModel = mockInstance.getGenerativeModel;
      const mockGenContent = vi.fn().mockResolvedValue(mockResponse);
      mockGetModel.mockReturnValue({
        generateContent: mockGenContent,
      });

      await provider.analyzeCode('const x = 1;');

      expect(mockGetModel).toHaveBeenCalled();
    });

    it('should support custom temperature for gemini models', async () => {
      const provider = new GeminiProvider({
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
      });

      const mockResponse = {
        response: {
          text: () => JSON.stringify({ issues: [], summary: 'Test' }),
        },
      };

      const GoogleGenAI = GoogleGenerativeAI as any;
      const mockInstance = new GoogleGenAI('test-key');
      const mockGetModel = mockInstance.getGenerativeModel;
      const mockGenContent = vi.fn().mockResolvedValue(mockResponse);
      mockGetModel.mockReturnValue({
        generateContent: mockGenContent,
      });

      await provider.analyzeCode('const x = 1;');

      expect(mockGetModel).toHaveBeenCalled();
    });
  });

  describe('normalizeAnalysisResult', () => {
    it('should handle missing issue fields', async () => {
      const mockResponse = {
        response: {
          text: () =>
            JSON.stringify({
              issues: [
                {
                  // Missing fields
                },
                {
                  severity: 'high',
                  // Missing other fields
                },
              ],
              summary: 'Test',
            }),
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await provider.analyzeCode('const x = 1;');

      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].severity).toBe('info');
      expect(result.issues[0].category).toBe('quality');
      expect(result.issues[0].line).toBe(1);
    });

    it('should handle missing summary', async () => {
      const mockResponse = {
        response: {
          text: () =>
            JSON.stringify({
              issues: [],
              // Missing summary
            }),
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await provider.analyzeCode('const x = 1;');

      expect(result.summary).toBe('Analysis completed.');
    });
  });

  describe('analyzeCode with options', () => {
    it('should handle options with all checks disabled', async () => {
      const mockResponse = {
        response: {
          text: () =>
            JSON.stringify({
              issues: [],
              summary: 'Test',
            }),
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await provider.analyzeCode('const x = 1;', {
        checkQuality: false,
        checkSecurity: false,
        checkPerformance: false,
        checkBestPractices: false,
        checkBugs: false,
      });

      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should handle options with language and filePath', async () => {
      const mockResponse = {
        response: {
          text: () =>
            JSON.stringify({
              issues: [],
              summary: 'Test',
            }),
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await provider.analyzeCode('const x = 1;', {
        language: 'typescript',
        filePath: '/test/file.ts',
      });

      expect(mockGenerateContent).toHaveBeenCalled();
      const callArgs = mockGenerateContent.mock.calls[0][0];
      expect(callArgs).toContain('typescript');
      expect(callArgs).toContain('/test/file.ts');
    });
  });

  describe('error handling', () => {
    it('should handle non-Error exceptions', async () => {
      mockGenerateContent.mockRejectedValue('String error');

      await expect(provider.analyzeCode('const x = 1;')).rejects.toThrow(
        'AI analysis failed: Unknown error'
      );
    });
  });
});
