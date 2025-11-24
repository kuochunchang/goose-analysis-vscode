import * as crypto from 'crypto';

/**
 * Compute SHA256 hash of a string
 * @param content - The content to hash
 * @returns The SHA256 hash as a hex string
 */
export function computeSHA256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
