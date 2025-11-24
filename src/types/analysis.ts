/**
 * AI analysis-related type definitions for VS Code extension
 * Based on the server types but simplified for extension use
 */

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IssueCategory = 'quality' | 'security' | 'performance' | 'best-practice' | 'bug';

export interface CodeExample {
  before: string;
  after: string;
}

export interface Issue {
  severity: IssueSeverity;
  category: IssueCategory;
  line: number;
  column?: number;
  message: string;
  suggestion: string;
  codeExample?: CodeExample;
}

export interface AnalysisResult {
  issues: Issue[];
  summary: string;
  timestamp: string;
}

export interface AnalysisOptions {
  language?: string;
  filePath?: string;
  checkQuality?: boolean;
  checkSecurity?: boolean;
  checkPerformance?: boolean;
  checkBestPractices?: boolean;
  checkBugs?: boolean;
}

export interface ComponentInfo {
  name: string;
  description: string;
  type: 'class' | 'function' | 'module' | 'interface' | 'constant' | 'type' | 'variable';
  codeSnippet?: string;
  line?: number;
}

export interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  line?: number;
}

export interface KeyConcept {
  concept: string;
  explanation: string;
}

export interface Dependency {
  name: string;
  purpose: string;
  isExternal: boolean;
}

export interface Field {
  name: string;
  type: string;
  description: string;
  line?: number;
  visibility?: 'public' | 'private' | 'protected';
}

export interface MethodDependency {
  caller: string;
  callee: string;
  callerLine?: number;
  calleeLine?: number;
  description?: string;
}

export interface ExplainResult {
  overview: string;
  fields?: Field[];
  mainComponents: ComponentInfo[];
  methodDependencies?: MethodDependency[];
  howItWorks: WorkflowStep[];
  keyConcepts: KeyConcept[];
  dependencies: Dependency[];
  notableFeatures: string[];
  timestamp: string;
}

/**
 * Cached insight for a file
 */
export interface CachedInsight {
  filePath: string;
  codeHash: string;
  analysis?: AnalysisResult;
  explain?: ExplainResult;
  timestamp: string;
}
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'typescriptreact'
  | 'javascriptreact'
  | 'java'
  | 'python';
