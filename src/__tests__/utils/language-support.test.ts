import { describe, it, expect } from 'vitest';
import {
  isSupportedLanguage,
  getLanguageName,
  getSupportedLanguagesList,
  isDiagramTypeSupported,
  getUnsupportedDiagramTypeMessage,
} from '../../utils/language-support.js';

describe('language-support', () => {
  describe('isSupportedLanguage', () => {
    it('should return true for supported languages', () => {
      expect(isSupportedLanguage('typescript')).toBe(true);
      expect(isSupportedLanguage('javascript')).toBe(true);
      expect(isSupportedLanguage('typescriptreact')).toBe(true);
      expect(isSupportedLanguage('javascriptreact')).toBe(true);
      expect(isSupportedLanguage('java')).toBe(true);
      expect(isSupportedLanguage('python')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(isSupportedLanguage('csharp')).toBe(false);
      expect(isSupportedLanguage('go')).toBe(false);
      expect(isSupportedLanguage('rust')).toBe(false);
      expect(isSupportedLanguage('')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(isSupportedLanguage('TypeScript')).toBe(false);
      expect(isSupportedLanguage('TYPESCRIPT')).toBe(false);
    });
  });

  describe('getLanguageName', () => {
    it('should return correct language names for supported languages', () => {
      expect(getLanguageName('typescript')).toBe('TypeScript');
      expect(getLanguageName('javascript')).toBe('JavaScript');
      expect(getLanguageName('typescriptreact')).toBe('TypeScript React');
      expect(getLanguageName('javascriptreact')).toBe('JavaScript React');
      expect(getLanguageName('java')).toBe('Java');
      expect(getLanguageName('python')).toBe('Python');
    });

    it('should return language ID for unknown languages', () => {
      expect(getLanguageName('unknown')).toBe('unknown');
      expect(getLanguageName('csharp')).toBe('csharp');
    });
  });

  describe('getSupportedLanguagesList', () => {
    it('should return the correct list of supported languages', () => {
      const list = getSupportedLanguagesList();
      expect(list).toBe('TypeScript, JavaScript, Java, and Python');
    });
  });

  describe('isDiagramTypeSupported', () => {
    describe('class diagrams', () => {
      it('should support class diagrams for all supported languages', () => {
        expect(isDiagramTypeSupported('typescript', 'class')).toBe(true);
        expect(isDiagramTypeSupported('javascript', 'class')).toBe(true);
        expect(isDiagramTypeSupported('typescriptreact', 'class')).toBe(true);
        expect(isDiagramTypeSupported('javascriptreact', 'class')).toBe(true);
        expect(isDiagramTypeSupported('java', 'class')).toBe(true);
        expect(isDiagramTypeSupported('python', 'class')).toBe(true);
      });

      it('should not support class diagrams for unsupported languages', () => {
        expect(isDiagramTypeSupported('csharp', 'class')).toBe(false);
      });
    });

    describe('sequence diagrams', () => {
      it('should support sequence diagrams for TypeScript/JavaScript', () => {
        expect(isDiagramTypeSupported('typescript', 'sequence')).toBe(true);
        expect(isDiagramTypeSupported('javascript', 'sequence')).toBe(true);
        expect(isDiagramTypeSupported('typescriptreact', 'sequence')).toBe(true);
        expect(isDiagramTypeSupported('javascriptreact', 'sequence')).toBe(true);
      });

      it('should not support sequence diagrams for Java/Python', () => {
        expect(isDiagramTypeSupported('java', 'sequence')).toBe(false);
        expect(isDiagramTypeSupported('python', 'sequence')).toBe(false);
      });

      it('should not support sequence diagrams for unsupported languages', () => {
        expect(isDiagramTypeSupported('csharp', 'sequence')).toBe(false);
      });
    });
  });

  describe('getUnsupportedDiagramTypeMessage', () => {
    it('should return correct message for unsupported sequence diagram', () => {
      const message = getUnsupportedDiagramTypeMessage('java', 'sequence');
      expect(message).toContain('sequence diagrams are currently only supported');
      expect(message).toContain('Java');
    });

    it('should return correct message for unsupported diagram type', () => {
      const message = getUnsupportedDiagramTypeMessage('python', 'sequence');
      expect(message).toContain('sequence diagrams are currently only supported');
      expect(message).toContain('Python');
    });

    it('should return correct message for unsupported class diagram type', () => {
      const message = getUnsupportedDiagramTypeMessage('csharp', 'class');
      expect(message).toContain('class diagrams are not supported');
      expect(message).toContain('csharp');
    });
  });

  describe('isDiagramTypeSupported edge cases', () => {
    it('should return false for unknown diagram type', () => {
      expect(isDiagramTypeSupported('typescript', 'unknown' as any)).toBe(false);
    });

    it('should handle empty language ID', () => {
      expect(isDiagramTypeSupported('', 'class')).toBe(false);
      expect(isDiagramTypeSupported('', 'sequence')).toBe(false);
    });
  });
});
