import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../../../services/providers/openai-provider.js';
import OpenAI from 'openai';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  };
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIProvider({
      apiKey: 'test-key',
      model: 'gpt-4',
    });
    mockClient = (OpenAI as any).mock.results[0].value;
  });

  describe('constructor', () => {
    it('should create provider with API key', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4',
      });
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should create provider with custom baseURL', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4',
        baseURL: 'http://localhost:8080',
      });
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should throw error when API key is missing and no baseURL', () => {
      expect(() => {
        new OpenAIProvider({
          apiKey: '',
          model: 'gpt-4',
        });
      }).toThrow('OpenAI API key is required');
    });

    it('should allow empty API key with custom baseURL', () => {
      const provider = new OpenAIProvider({
        apiKey: '',
        model: 'gpt-4',
        baseURL: 'http://localhost:8080',
      });
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('analyzeCode', () => {
    it('should analyze code and return result', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
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
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.analyzeCode('const x = 1;');

      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('timestamp');
      expect(mockClient.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle JSON wrapped in code blocks', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '```json\n{"issues":[],"summary":"Test"}\n```',
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.analyzeCode('const x = 1;');

      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('summary');
    });

    it('should handle errors from API', async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(provider.analyzeCode('const x = 1;')).rejects.toThrow(
        'AI analysis failed: API Error'
      );
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(provider.analyzeCode('const x = 1;')).rejects.toThrow('No response from OpenAI');
    });
  });

  describe('explainCode', () => {
    it('should explain code and return result', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                overview: 'Test overview',
                mainComponents: [],
                howItWorks: [],
                keyConcepts: [],
                dependencies: [],
                notableFeatures: [],
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.explainCode('const x = 1;');

      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('mainComponents');
      expect(result).toHaveProperty('howItWorks');
      expect(result).toHaveProperty('timestamp');
      expect(mockClient.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle errors from API', async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error('API Error'));

      await expect(provider.explainCode('const x = 1;')).rejects.toThrow(
        'Code explanation failed: API Error'
      );
    });

    it('should handle JSON wrapped in plain code blocks', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '```\n{"overview":"Test","mainComponents":[]}\n```',
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.explainCode('const x = 1;');

      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('mainComponents');
    });

    it('should handle response without code blocks', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '{"overview":"Test","mainComponents":[]}',
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.explainCode('const x = 1;');

      expect(result).toHaveProperty('overview');
    });
  });

  describe('model support detection', () => {
    it('should support JSON mode for gpt-4o', async () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4o',
      });

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ issues: [], summary: 'Test' }),
            },
          },
        ],
      };

      const mockClient = (OpenAI as any).mock.results[(OpenAI as any).mock.results.length - 1]
        .value;
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.analyzeCode('const x = 1;');

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
    });

    it('should support JSON mode for o1 model', async () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'o1',
      });

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ issues: [], summary: 'Test' }),
            },
          },
        ],
      };

      const mockClient = (OpenAI as any).mock.results[(OpenAI as any).mock.results.length - 1]
        .value;
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.analyzeCode('const x = 1;');

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.response_format).toEqual({ type: 'json_object' });
    });

    it('should not support JSON mode for unknown model', async () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'unknown-model',
      });

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ issues: [], summary: 'Test' }),
            },
          },
        ],
      };

      const mockClient = (OpenAI as any).mock.results[(OpenAI as any).mock.results.length - 1]
        .value;
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.analyzeCode('const x = 1;');

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.response_format).toBeUndefined();
    });

    it('should not support custom temperature for o1 model', async () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'o1',
      });

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ issues: [], summary: 'Test' }),
            },
          },
        ],
      };

      const mockClient = (OpenAI as any).mock.results[(OpenAI as any).mock.results.length - 1]
        .value;
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.analyzeCode('const x = 1;');

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.temperature).toBeUndefined();
    });

    it('should support custom temperature for gpt-4', async () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4',
      });

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ issues: [], summary: 'Test' }),
            },
          },
        ],
      };

      const mockClient = (OpenAI as any).mock.results[(OpenAI as any).mock.results.length - 1]
        .value;
      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.analyzeCode('const x = 1;');

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.temperature).toBe(0.3);
    });
  });

  describe('normalizeAnalysisResult', () => {
    it('should handle missing issue fields', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                issues: [
                  {
                    // Missing severity, category, line, message, suggestion
                  },
                  {
                    severity: 'high',
                    // Missing other fields
                  },
                ],
                summary: 'Test',
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.analyzeCode('const x = 1;');

      expect(result.issues).toHaveLength(2);
      expect(result.issues[0].severity).toBe('info');
      expect(result.issues[0].category).toBe('quality');
      expect(result.issues[0].line).toBe(1);
      expect(result.issues[0].message).toBe('');
      expect(result.issues[0].suggestion).toBe('');
    });

    it('should handle missing summary', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                issues: [],
                // Missing summary
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.analyzeCode('const x = 1;');

      expect(result.summary).toBe('Analysis completed.');
    });
  });

  describe('analyzeCode with options', () => {
    it('should handle options with all checks disabled', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                issues: [],
                summary: 'Test',
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.analyzeCode('const x = 1;', {
        checkQuality: false,
        checkSecurity: false,
        checkPerformance: false,
        checkBestPractices: false,
        checkBugs: false,
      });

      expect(mockClient.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle options with language and filePath', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                issues: [],
                summary: 'Test',
              }),
            },
          },
        ],
      };

      mockClient.chat.completions.create.mockResolvedValue(mockResponse);

      await provider.analyzeCode('const x = 1;', {
        language: 'typescript',
        filePath: '/test/file.ts',
      });

      const callArgs = mockClient.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[1].content).toContain('typescript');
      expect(callArgs.messages[1].content).toContain('/test/file.ts');
    });
  });

  describe('error handling', () => {
    it('should handle non-Error exceptions', async () => {
      mockClient.chat.completions.create.mockRejectedValue('String error');

      await expect(provider.analyzeCode('const x = 1;')).rejects.toThrow(
        'AI analysis failed: Unknown error'
      );
    });
  });
});
