import { parseMimeType, createWavHeader, convertToWav } from './mime-type.util';

describe('mime-type.util', () => {
  describe('parseMimeType', () => {
    it('should parse complex mimeType with rate and channels parameters', () => {
      const result = parseMimeType('audio/l16; rate=24000; channels=1');
      expect(result.baseType).toBe('audio/l16');
      expect(result.sampleRate).toBe(24000);
      expect(result.numChannels).toBe(1);
      expect(result.bitsPerSample).toBe(16);
    });

    it('should parse lower case parameters and rate differences correctly', () => {
      const result = parseMimeType('audio/pcm; rate=16000; channels=2');
      expect(result.baseType).toBe('audio/pcm');
      expect(result.sampleRate).toBe(16000);
      expect(result.numChannels).toBe(2);
      expect(result.bitsPerSample).toBe(16); // fallback
    });

    it('should parse bits dynamically from format subtypes like l24', () => {
      const result = parseMimeType('audio/l24; rate=16000; channels=2');
      expect(result.baseType).toBe('audio/l24');
      expect(result.sampleRate).toBe(16000);
      expect(result.numChannels).toBe(2);
      expect(result.bitsPerSample).toBe(24);
    });

    it('should fall back to standard defaults if parameters are missing', () => {
      const result = parseMimeType('audio/l16');
      expect(result.baseType).toBe('audio/l16');
      expect(result.sampleRate).toBe(24000); // default
      expect(result.numChannels).toBe(1); // default
      expect(result.bitsPerSample).toBe(16);
    });

    it('should handle empty or malformed parameters gracefully', () => {
      const result = parseMimeType('; rate=abc; channels=');
      expect(result.baseType).toBe('audio/l16');
      expect(result.sampleRate).toBe(24000);
      expect(result.numChannels).toBe(1);
      expect(result.bitsPerSample).toBe(16);
    });
  });

  describe('createWavHeader', () => {
    it('should generate a correct 44-byte WAV header buffer', () => {
      const header = createWavHeader(100, {
        sampleRate: 24000,
        numChannels: 1,
        bitsPerSample: 16,
      });

      expect(header).toBeInstanceOf(Uint8Array);
      expect(header.length).toBe(44);

      // Verify some header markers
      const view = new DataView(header.buffer);
      // ChunkID 'RIFF' (0x52, 0x49, 0x46, 0x46)
      expect(view.getUint8(0)).toBe(0x52);
      expect(view.getUint8(1)).toBe(0x49);
      expect(view.getUint8(2)).toBe(0x46);
      expect(view.getUint8(3)).toBe(0x46);

      // ChunkSize: 36 + 100 = 136
      expect(view.getUint32(4, true)).toBe(136);

      // Format 'WAVE' (0x57, 0x41, 0x56, 0x45)
      expect(view.getUint8(8)).toBe(0x57);
      expect(view.getUint8(9)).toBe(0x41);

      // Subchunk2Size: 100
      expect(view.getUint32(40, true)).toBe(100);
    });
  });

  describe('convertToWav', () => {
    it('should convert raw Uint8Array pcm to audio/wav Blob with header prepended', () => {
      const rawData = new Uint8Array([1, 2, 3, 4]);
      const blob = convertToWav(rawData, 'audio/l16; rate=16000; channels=2');

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
      expect(blob.size).toBe(44 + 4); // 44 bytes header + 4 bytes payload
    });
  });
});
