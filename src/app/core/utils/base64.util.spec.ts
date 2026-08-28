import { decodeBase64, decodeBase64AsBlobPart } from './base64.util';

describe('base64.util', () => {
  describe('decodeBase64', () => {
    it('should decode base64 encoded string to Uint8Array', () => {
      // 'SGVsbG8=' is base64 for 'Hello'
      const base64 = 'SGVsbG8=';
      const result = decodeBase64(base64);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(5);
      expect(result[0]).toBe(72); // 'H'
      expect(result[1]).toBe(101); // 'e'
      expect(result[2]).toBe(108); // 'l'
      expect(result[3]).toBe(108); // 'l'
      expect(result[4]).toBe(111); // 'o'
    });
  });

  describe('decodeBase64AsBlobPart', () => {
    it('should decode base64 and return a compatible binary output', () => {
      const base64 = 'SGVsbG8=';
      const result = decodeBase64AsBlobPart(base64);

      expect(result).toBeInstanceOf(Uint8Array);
    });
  });
});
