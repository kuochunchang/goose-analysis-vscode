import { describe, it, expect } from 'vitest';
import { computeSHA256 } from '../../utils/hash.js';

describe('hash', () => {
  describe('computeSHA256', () => {
    it('should compute SHA256 hash correctly', () => {
      const content = 'test content';
      const hash = computeSHA256(content);

      // SHA256 produces 64 character hex string
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = computeSHA256('content1');
      const hash2 = computeSHA256('content2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce same hash for same content', () => {
      const content = 'same content';
      const hash1 = computeSHA256(content);
      const hash2 = computeSHA256(content);

      expect(hash1).toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = computeSHA256('');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle special characters', () => {
      const content = 'test@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = computeSHA256(content);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle unicode characters', () => {
      const content = '测试内容 🚀';
      const hash = computeSHA256(content);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle multiline content', () => {
      const content = 'line1\nline2\nline3';
      const hash = computeSHA256(content);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
