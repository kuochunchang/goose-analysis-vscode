import * as vscode from 'vscode';
import type {
  IAIProvider,
  AIProviderType,
  OpenAIProviderConfig,
  GeminiProviderConfig,
} from './ai-provider.interface.js';
import { OpenAIProvider } from './openai-provider.js';
import { GeminiProvider } from './gemini-provider.js';

/**
 * Configuration for creating an AI provider
 */
export interface AIProviderFactoryConfig {
  provider: AIProviderType;
  openai?: OpenAIProviderConfig;
  gemini?: GeminiProviderConfig;
}

/**
 * Factory for creating AI providers
 * Supports OpenAI and Gemini providers
 */
export class AIProviderFactory {
  /**
   * Create an AI provider based on configuration
   * @param config - Provider configuration
   * @returns AI provider instance
   */
  static create(config: AIProviderFactoryConfig): IAIProvider {
    switch (config.provider) {
      case 'openai':
        if (!config.openai) {
          throw new Error('OpenAI configuration is required when provider is "openai"');
        }
        return new OpenAIProvider(config.openai);

      case 'gemini':
        if (!config.gemini) {
          throw new Error('Gemini configuration is required when provider is "gemini"');
        }
        return new GeminiProvider(config.gemini);

      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  }
}

/**
 * Get AI provider from VS Code configuration
 * Reads settings and creates appropriate provider instance
 */
export async function getAIProvider(context: vscode.ExtensionContext): Promise<IAIProvider> {
  const config = vscode.workspace.getConfiguration('gooseCodeReview');
  const providerType = config.get<AIProviderType>('aiProvider', 'openai');

  if (providerType === 'gemini') {
    const geminiApiKey = await context.secrets.get('gemini-api-key') ||
                         config.get<string>('geminiApiKey', '');
    const geminiModel = config.get<string>('geminiModel', 'gemini-pro');

    if (!geminiApiKey) {
      throw new Error('Gemini API key is required. Please configure it in extension settings.');
    }

    return AIProviderFactory.create({
      provider: 'gemini',
      gemini: {
        apiKey: geminiApiKey,
        model: geminiModel,
        timeout: 60000,
      },
    });
  } else {
    // Default to OpenAI
    const openaiApiKey = await context.secrets.get('openai-api-key') ||
                         config.get<string>('openaiApiKey', '');
    const model = config.get<string>('analysisModel', 'gpt-4');
    const useCustomApi = config.get<boolean>('useCustomApi', false);
    const customApiUrl = config.get<string>('customApiUrl', '');
    const customModelName = config.get<string>('customModelName', '');

    if (!openaiApiKey && !useCustomApi) {
      throw new Error('OpenAI API key is required. Please configure it in extension settings.');
    }

    if (useCustomApi && !customApiUrl) {
      throw new Error('Custom API URL is required when using custom API.');
    }

    const modelToUse = useCustomApi ? (customModelName || model) : model;

    return AIProviderFactory.create({
      provider: 'openai',
      openai: {
        apiKey: openaiApiKey || 'dummy-key', // Some custom APIs don't require API key
        model: modelToUse,
        timeout: 60000,
        baseURL: useCustomApi ? customApiUrl : undefined,
      },
    });
  }
}
