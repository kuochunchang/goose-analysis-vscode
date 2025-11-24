import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIProviderFactory, getAIProvider } from '../../../services/providers/provider-factory.js';
import { OpenAIProvider } from '../../../services/providers/openai-provider.js';
import { GeminiProvider } from '../../../services/providers/gemini-provider.js';
import { createMockExtensionContext, createMockConfiguration } from '../../mocks/vscode-mock.js';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
}));

describe('AIProviderFactory', () => {
  describe('create', () => {
    it('should create OpenAIProvider for openai type', () => {
      const provider = AIProviderFactory.create({
        provider: 'openai',
        openai: {
          apiKey: 'test-key',
          model: 'gpt-4',
        },
      });

      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('should create GeminiProvider for gemini type', () => {
      const provider = AIProviderFactory.create({
        provider: 'gemini',
        gemini: {
          apiKey: 'test-key',
          model: 'gemini-pro',
        },
      });

      expect(provider).toBeInstanceOf(GeminiProvider);
    });

    it('should throw error when openai config is missing for openai provider', () => {
      expect(() => {
        AIProviderFactory.create({
          provider: 'openai',
        });
      }).toThrow('OpenAI configuration is required when provider is "openai"');
    });

    it('should throw error when gemini config is missing for gemini provider', () => {
      expect(() => {
        AIProviderFactory.create({
          provider: 'gemini',
        });
      }).toThrow('Gemini configuration is required when provider is "gemini"');
    });

    it('should throw error for unknown provider type', () => {
      expect(() => {
        AIProviderFactory.create({
          provider: 'unknown' as any,
        });
      }).toThrow('Unknown AI provider: unknown');
    });
  });
});

describe('getAIProvider', () => {
  let context: ReturnType<typeof createMockExtensionContext>;
  let mockConfig: ReturnType<typeof createMockConfiguration>;

  beforeEach(() => {
    context = createMockExtensionContext();
    mockConfig = createMockConfiguration();
    vi.mocked(vscode.workspace.getConfiguration).mockImplementation((section?: string) => {
      if (section === 'gooseCodeReview') {
        return mockConfig as any;
      }
      return createMockConfiguration() as any;
    });
  });

  it('should create OpenAI provider with API key from secrets', async () => {
    await context.secrets.store('openai-api-key', 'secret-key');
    mockConfig = createMockConfiguration({
      analysisModel: 'gpt-4',
      useCustomApi: false,
    });

    const provider = await getAIProvider(context as any);

    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('should create OpenAI provider with API key from config', async () => {
    mockConfig = createMockConfiguration({
      openaiApiKey: 'config-key',
      analysisModel: 'gpt-4',
      useCustomApi: false,
    });

    const provider = await getAIProvider(context as any);

    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('should create OpenAI provider with custom API', async () => {
    mockConfig = createMockConfiguration({
      useCustomApi: true,
      customApiUrl: 'http://localhost:8080',
      customModelName: 'custom-model',
      analysisModel: 'gpt-4',
    });

    const provider = await getAIProvider(context as any);

    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('should create Gemini provider with API key from secrets', async () => {
    await context.secrets.store('gemini-api-key', 'secret-key');
    mockConfig = createMockConfiguration({
      aiProvider: 'gemini',
      geminiModel: 'gemini-pro',
    });

    const provider = await getAIProvider(context as any);

    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('should create Gemini provider with API key from config', async () => {
    mockConfig = createMockConfiguration({
      aiProvider: 'gemini',
      geminiApiKey: 'config-key',
      geminiModel: 'gemini-pro',
    });

    const provider = await getAIProvider(context as any);

    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('should throw error when OpenAI API key is missing', async () => {
    mockConfig = createMockConfiguration({
      useCustomApi: false,
    });

    await expect(getAIProvider(context as any)).rejects.toThrow('OpenAI API key is required');
  });

  it('should throw error when Gemini API key is missing', async () => {
    mockConfig = createMockConfiguration({
      aiProvider: 'gemini',
    });

    await expect(getAIProvider(context as any)).rejects.toThrow('Gemini API key is required');
  });

  it('should throw error when custom API URL is missing', async () => {
    mockConfig = createMockConfiguration({
      useCustomApi: true,
      customApiUrl: '',
    });

    await expect(getAIProvider(context as any)).rejects.toThrow(
      'Custom API URL is required when using custom API'
    );
  });

  it('should use default model when not specified', async () => {
    await context.secrets.store('openai-api-key', 'test-key');
    mockConfig = createMockConfiguration({
      useCustomApi: false,
    });

    const provider = await getAIProvider(context as any);

    expect(provider).toBeInstanceOf(OpenAIProvider);
  });
});
