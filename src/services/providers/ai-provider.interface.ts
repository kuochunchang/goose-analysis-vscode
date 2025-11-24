import type { AnalysisOptions, AnalysisResult, ExplainResult } from '../../types/analysis.js';

/**
 * AI Provider interface for code analysis and explanation
 * Supports multiple AI providers (OpenAI, Gemini, etc.)
 */
export interface IAIProvider {
  /**
   * Analyze code and return issues and summary
   * @param code - Source code to analyze
   * @param options - Analysis options (language, file path, checks to perform)
   * @returns Analysis result with issues and summary
   */
  analyzeCode(code: string, options?: AnalysisOptions): Promise<AnalysisResult>;

  /**
   * Explain code in detail
   * @param code - Source code to explain
   * @param options - Analysis options (language, file path)
   * @returns Detailed explanation with components, dependencies, workflow
   */
  explainCode(code: string, options?: AnalysisOptions): Promise<ExplainResult>;
}

/**
 * Base configuration for AI providers
 */
export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  timeout?: number;
}

/**
 * OpenAI-specific configuration
 */
export interface OpenAIProviderConfig extends AIProviderConfig {
  baseURL?: string;
}

/**
 * Gemini-specific configuration
 */
export interface GeminiProviderConfig extends AIProviderConfig {
  // Add Gemini-specific configuration here if needed
}

/**
 * Provider type enum
 */
export type AIProviderType = 'openai' | 'gemini';
