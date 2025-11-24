import type { AnalysisOptions, AnalysisResult, ExplainResult } from '../types/analysis.js';
import type { IAIProvider } from './providers/ai-provider.interface.js';

/**
 * Analysis service that delegates to an AI provider
 * Supports multiple AI providers through dependency injection
 */
export class AnalysisService {
  private provider: IAIProvider;

  constructor(provider: IAIProvider) {
    this.provider = provider;
  }

  /**
   * Analyze code and return issues and summary
   */
  async analyzeCode(code: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    return this.provider.analyzeCode(code, options);
  }

  /**
   * Explain code in detail
   */
  async explainCode(code: string, options: AnalysisOptions = {}): Promise<ExplainResult> {
    return this.provider.explainCode(code, options);
  }
}
