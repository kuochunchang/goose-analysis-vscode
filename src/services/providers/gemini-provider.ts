import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { AnalysisOptions, AnalysisResult, ExplainResult, Issue } from '../../types/analysis.js';
import type { IAIProvider, GeminiProviderConfig } from './ai-provider.interface.js';

/**
 * Gemini provider for code analysis and explanation
 * Supports Google's latest Gemini models (3.0, 2.5, 2.0 series)
 */
export class GeminiProvider implements IAIProvider {
  private client: GoogleGenerativeAI;
  private model: string;
  private generativeModel: GenerativeModel;

  constructor(config: GeminiProviderConfig) {
    if (!config.apiKey) {
      throw new Error('Gemini API key is required');
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = config.model || 'gemini-2.5-flash';

    // Initialize the generative model with JSON mode support
    this.generativeModel = this.client.getGenerativeModel({
      model: this.model,
    });
  }

  /**
   * Analyze code and return issues and summary
   */
  async analyzeCode(code: string, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    const prompt = this.buildAnalysisPrompt(code, options);
    const systemInstruction = 'You are a professional code reviewer. Analyze code and provide detailed feedback in JSON format.';

    try {
      const result = await this.generateContent({
        systemInstruction,
        prompt,
        temperature: this.supportsCustomTemperature() ? 0.3 : undefined,
        useJsonMode: this.supportsJsonMode(),
      });

      const jsonContent = this.extractJSON(result);
      const parsed = JSON.parse(jsonContent);
      return this.normalizeAnalysisResult(parsed);
    } catch (error) {
      console.error('Gemini API error:', error);
      if (error instanceof Error) {
        throw new Error(`AI analysis failed: ${error.message}`);
      }
      throw new Error('AI analysis failed: Unknown error');
    }
  }

  /**
   * Explain code in detail
   */
  async explainCode(code: string, options: AnalysisOptions = {}): Promise<ExplainResult> {
    const prompt = this.buildExplainPrompt(code, options);
    const systemInstruction = 'You are an expert code explainer. Provide clear, comprehensive explanations of code in structured JSON format.';

    try {
      const result = await this.generateContent({
        systemInstruction,
        prompt,
        temperature: this.supportsCustomTemperature() ? 0.4 : undefined,
        useJsonMode: this.supportsJsonMode(),
      });

      const jsonContent = this.extractJSON(result);
      const parsed = JSON.parse(jsonContent);

      return {
        overview: parsed.overview || '',
        fields: parsed.fields || [],
        mainComponents: parsed.mainComponents || [],
        methodDependencies: parsed.methodDependencies || [],
        howItWorks: parsed.howItWorks || [],
        keyConcepts: parsed.keyConcepts || [],
        dependencies: parsed.dependencies || [],
        notableFeatures: parsed.notableFeatures || [],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      if (error instanceof Error) {
        throw new Error(`Code explanation failed: ${error.message}`);
      }
      throw new Error('Code explanation failed: Unknown error');
    }
  }

  /**
   * Generate content using Gemini API
   */
  private async generateContent(config: {
    systemInstruction: string;
    prompt: string;
    temperature?: number;
    useJsonMode: boolean;
  }): Promise<string> {
    const generationConfig: any = {};

    if (config.temperature !== undefined) {
      generationConfig.temperature = config.temperature;
    }

    if (config.useJsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig,
      systemInstruction: config.systemInstruction,
    });

    const result = await model.generateContent(config.prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error('No response from Gemini');
    }

    return text;
  }

  /**
   * Build prompt for code analysis
   */
  private buildAnalysisPrompt(code: string, options: AnalysisOptions): string {
    const checks: string[] = [];

    if (options.checkQuality !== false) {
      checks.push('1. Code Quality (naming, structure, readability)');
    }
    if (options.checkSecurity !== false) {
      checks.push('2. Security Vulnerabilities (SQL injection, XSS, sensitive data exposure)');
    }
    if (options.checkPerformance !== false) {
      checks.push('3. Performance Issues (bottlenecks, memory leaks)');
    }
    if (options.checkBestPractices !== false) {
      checks.push('4. Best Practices (framework-specific)');
    }
    if (options.checkBugs !== false) {
      checks.push('5. Potential Bugs (logic errors, edge cases)');
    }

    const language = options.language || 'unknown';
    const filePath = options.filePath || 'unknown';

    return `Analyze the following ${language} code from ${filePath}.

Check for:
${checks.join('\n')}

Return the results in the following JSON format:
{
  "issues": [
    {
      "severity": "critical|high|medium|low|info",
      "category": "quality|security|performance|best-practice|bug",
      "line": <line_number>,
      "column": <column_number>,
      "message": "<description_of_issue>",
      "suggestion": "<how_to_fix_it>",
      "codeExample": {
        "before": "<problematic_code>",
        "after": "<improved_code>"
      }
    }
  ],
  "summary": "<overall_summary_of_code_quality>"
}

Code:
\`\`\`${language}
${code}
\`\`\`

Provide specific, actionable feedback. Focus on the most important issues.`;
  }

  /**
   * Build prompt for code explanation
   */
  private buildExplainPrompt(code: string, options: AnalysisOptions): string {
    const language = options.language || 'unknown';
    const filePath = options.filePath || 'unknown';

    return `Explain the following ${language} code from ${filePath}.

Return the explanation in the following JSON format:
{
  "overview": "Brief 2-3 sentence summary of what the code does",
  "fields": [
    {
      "name": "fieldName",
      "type": "string|number|boolean|object|ClassName",
      "description": "What this field stores or represents",
      "line": 5,
      "visibility": "public|private|protected"
    }
  ],
  "mainComponents": [
    {
      "name": "ComponentName",
      "description": "What this component does",
      "type": "class|function|module|interface|constant|type|variable",
      "codeSnippet": "Optional: key code snippet",
      "line": 10
    }
  ],
  "methodDependencies": [
    {
      "caller": "methodA",
      "callee": "methodB",
      "callerLine": 20,
      "calleeLine": 35,
      "description": "methodA calls methodB to process data"
    }
  ],
  "howItWorks": [
    {
      "step": 1,
      "title": "Short title of this step",
      "description": "Detailed explanation of what happens in this step",
      "line": 15
    }
  ],
  "keyConcepts": [
    {
      "concept": "Concept name (e.g., 'Dependency Injection')",
      "explanation": "Clear explanation of this concept and how it's used"
    }
  ],
  "dependencies": [
    {
      "name": "Module or library name",
      "purpose": "What it's used for in this code",
      "isExternal": true
    }
  ],
  "notableFeatures": [
    "Highlight 1: Description",
    "Highlight 2: Description"
  ]
}

Code (with line numbers):
\`\`\`${language}
${code
  .split('\n')
  .map((line, i) => `${i + 1}: ${line}`)
  .join('\n')}
\`\`\`

Guidelines:
- Be specific and educational
- Include actual names from the code
- Keep descriptions clear and concise
- Focus on the most important aspects
- Order steps logically in howItWorks
- **IMPORTANT**: Include line numbers for fields, mainComponents, methodDependencies, and howItWorks to enable code navigation
- Line numbers should correspond to where the item is defined or where the action occurs in the code

**For fields** (class/module-level data fields ONLY):
- List class or module-level data fields (properties, state variables, instance variables)
- Examples: class properties, instance variables, module-level state
- Do NOT include: local variables, function parameters, constants, or methods
- Include visibility (public/private/protected) when it's clear from the code

**For mainComponents** (all major code structures):
- **MUST include ALL**: classes, methods/functions, constants, interfaces, types, modules
- For methods: List all important methods/functions (both class methods and standalone functions)
- For constants: List all important constant declarations (const, final, readonly values)
- For classes: List all class definitions
- This is where methods and constants should appear - NOT in fields

**For methodDependencies** (method call relationships within this file):
- Analyze which methods/functions call other methods/functions in THIS file
- Only include internal dependencies (within the same file)
- Provide line numbers for both caller and callee
- Add brief description of why the dependency exists
- This helps visualize the code flow and structure`;
  }

  /**
   * Normalize analysis result
   */
  private normalizeAnalysisResult(result: any): AnalysisResult {
    return {
      issues: (result.issues || []).map(
        (issue: any): Issue => ({
          severity: issue.severity || 'info',
          category: issue.category || 'quality',
          line: issue.line || 1,
          column: issue.column,
          message: issue.message || '',
          suggestion: issue.suggestion || '',
          codeExample: issue.codeExample,
        })
      ),
      summary: result.summary || 'Analysis completed.',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Extract JSON from response (handles markdown code blocks)
   */
  private extractJSON(content: string): string {
    const jsonCodeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonCodeBlockMatch) {
      return jsonCodeBlockMatch[1].trim();
    }

    const codeBlockMatch = content.match(/```\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    return content.trim();
  }

  /**
   * Check if model supports JSON mode
   * All Gemini 2.0+ models support JSON mode via responseMimeType
   */
  private supportsJsonMode(): boolean {
    const jsonModeSupportedModels = [
      // Gemini 3 series
      'gemini-3',
      // Gemini 2.5 series
      'gemini-2.5',
      // Gemini 2.0 series
      'gemini-2.0',
      // Gemini 1.5 series also supports JSON mode
      'gemini-1.5',
    ];

    return jsonModeSupportedModels.some((supportedModel) =>
      this.model.startsWith(supportedModel)
    );
  }

  /**
   * Check if model supports custom temperature
   * Most Gemini models support custom temperature except for some specialized variants
   */
  private supportsCustomTemperature(): boolean {
    // Most Gemini models support custom temperature
    // Only exclude specific models if they don't support it
    const noCustomTempModels: string[] = [
      // Add models that don't support custom temperature here if any
    ];

    const isRestricted = noCustomTempModels.some((restrictedModel) =>
      this.model.startsWith(restrictedModel)
    );

    return !isRestricted;
  }
}
