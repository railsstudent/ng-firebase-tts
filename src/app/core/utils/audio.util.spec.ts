import { decodeAudioChunk, normalizePcmSamples, recordStreamChunks, toWavBlob } from '@/core/utils/audio.util';
import { AudioStreamChunk } from '@/core/interfaces/text-to-speech.interface';

describe('audio.util', () => {
  describe('normalizePcmSamples', () => {
    it('should return empty Float32Array for empty Uint8Array', () => {
      const emptyInput = new Uint8Array(0);
      const result = normalizePcmSamples(emptyInput);
      expect(result.length).toBe(0);
    });

    it('should handle odd byte lengths by truncating the last byte', () => {
      const oddInput = new Uint8Array([0, 0, 123]);
      const result = normalizePcmSamples(oddInput);
      expect(result.length).toBe(1);
    });

    it('should correctly normalize signed 16-bit integer PCM values to floats', () => {
      const rawBuffer = new ArrayBuffer(6);
      const int16View = new Int16Array(rawBuffer);
      int16View[0] = 0;
      int16View[1] = 16384;
      int16View[2] = -32768;

      const u8Input = new Uint8Array(rawBuffer);
      const result = normalizePcmSamples(u8Input);

      expect(result.length).toBe(3);
      expect(result[0]).toBeCloseTo(0.0, 5);
      expect(result[1]).toBeCloseTo(0.5, 5);
      expect(result[2]).toBeCloseTo(-1.0, 5);
    });

    it('should scale samples by gain and clamp values to [-1.0, 1.0] safety boundaries', () => {
      const rawBuffer = new ArrayBuffer(4);
      const int16View = new Int16Array(rawBuffer);
      int16View[0] = 16384; // Normalizes to 0.5
      int16View[1] = -24576; // Normalizes to -0.75

      const u8Input = new Uint8Array(rawBuffer);
      const result = normalizePcmSamples(u8Input, 2.0);

      expect(result.length).toBe(2);
      expect(result[0]).toBeCloseTo(1.0, 5);
      expect(result[1]).toBeCloseTo(-1.0, 5); // Clamped
    });
  });

  describe('decodeAudioChunk', () => {
    it('should decode base64 audio payload and extract sample rate from mimeType', () => {
      const chunk = decodeAudioChunk('SGVsbG8=', 'audio/l16; rate=16000; channels=1');

      expect(chunk.decodedData).toBeInstanceOf(Uint8Array);
      expect(chunk.decodedData.length).toBe(5);
      expect(chunk.decodedData[0]).toBe(72);
      expect(chunk.decodedData[1]).toBe(101);
      expect(chunk.decodedData[2]).toBe(108);
      expect(chunk.decodedData[3]).toBe(108);
      expect(chunk.decodedData[4]).toBe(111);
      expect(chunk.sampleRate).toBe(16000);
    });

    it('should fallback to DEFAULT_SAMPLE_RATE if mimeType is omitted or lacks rate', () => {
      const chunk = decodeAudioChunk('SGVsbG8=');
      expect(chunk.sampleRate).toBe(24000);
    });

    it('should handle custom channels and bit formats in mimeType', () => {
      const chunk = decodeAudioChunk('SGVsbG8=', 'audio/l24; rate=48000; channels=2');
      expect(chunk.sampleRate).toBe(48000);
    });
  });

  describe('toWavBlob', () => {
    it('should convert raw Uint8Array pcm to audio/wav Blob with 44-byte RIFF header prepended', () => {
      const rawData = new Uint8Array([1, 2, 3, 4]);
      const blob = toWavBlob(rawData, 'audio/l16; rate=16000; channels=2');

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
      expect(blob.size).toBe(44 + 4);
    });

    it('should verify WAV header markers and chunk offsets', async () => {
      const rawData = new Uint8Array(100);
      const blob = toWavBlob(rawData, 'audio/l16; rate=24000; channels=1');

      const arrayBuffer = await blob.arrayBuffer();
      const view = new DataView(arrayBuffer);

      // Verify some header markers
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

    it('should fallback to 16 bits per sample when MIME format lacks "l" prefix or valid bits', async () => {
      const rawData = new Uint8Array(4);
      // 'audio/pcm' does not start with 'l'
      const blobNonL = toWavBlob(rawData, 'audio/pcm; rate=24000; channels=1');
      const viewNonL = new DataView(await blobNonL.arrayBuffer());
      // BitsPerSample at offset 34 should fallback to 16
      expect(viewNonL.getUint16(34, true)).toBe(16);

      // 'audio/linear' starts with 'l' but has no valid integer immediately after
      const blobNonNumeric = toWavBlob(rawData, 'audio/linear; rate=24000; channels=1');
      const viewNonNumeric = new DataView(await blobNonNumeric.arrayBuffer());
      expect(viewNonNumeric.getUint16(34, true)).toBe(16);
    });

    it('should accept an array of Uint8Array chunks and merge them into a valid audio/wav Blob', () => {
      const chunk1 = new Uint8Array([1, 2]);
      const chunk2 = new Uint8Array([3, 4, 5]);
      const blob = toWavBlob([chunk1, chunk2], 'audio/l16; rate=16000; channels=1');

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
      expect(blob.size).toBe(44 + 5);
    });

    it('should accept a base64 encoded string directly and produce a valid audio/wav Blob', () => {
      const base64Data = 'SGVsbG8=';
      const blob = toWavBlob(base64Data, 'audio/l16; rate=24000; channels=1');

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
      expect(blob.size).toBe(44 + 5);
    });
  });

  describe('recordStreamChunks', () => {
    async function* createMockStream(chunks: AudioStreamChunk[]): AsyncGenerator<AudioStreamChunk, void, unknown> {
      for (const chunk of chunks) {
        yield chunk;
      }
    }

    it('should push decoded chunk bytes into the buffer while yielding the chunks', async () => {
      const chunk1: AudioStreamChunk = {
        decodedData: new Uint8Array([1, 2]),
        sampleRate: 24000,
        mimeType: 'audio/l16',
      };
      const chunk2: AudioStreamChunk = {
        decodedData: new Uint8Array([3, 4, 5]),
        sampleRate: 24000,
        mimeType: 'audio/l16',
      };

      const buffer: Uint8Array[] = [];
      const yieldedChunks: AudioStreamChunk[] = [];

      for await (const chunk of recordStreamChunks(createMockStream([chunk1, chunk2]), buffer)) {
        yieldedChunks.push(chunk);
      }

      expect(yieldedChunks).toEqual([chunk1, chunk2]);
      expect(buffer).toEqual([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])]);
    });

    it('should handle an empty stream by keeping buffer empty and yielding nothing', async () => {
      const buffer: Uint8Array[] = [];
      const yieldedChunks: AudioStreamChunk[] = [];

      for await (const chunk of recordStreamChunks(createMockStream([]), buffer)) {
        yieldedChunks.push(chunk);
      }

      expect(yieldedChunks).toEqual([]);
      expect(buffer).toEqual([]);
    });

    it('should push received chunks to buffer before propagating mid-stream error', async () => {
      async function* createErrorStream(): AsyncGenerator<AudioStreamChunk, void, unknown> {
        yield {
          decodedData: new Uint8Array([10, 20]),
          sampleRate: 24000,
          mimeType: 'audio/l16',
        };
        throw new Error('Network stream interrupted');
      }

      const buffer: Uint8Array[] = [];
      const yieldedChunks: AudioStreamChunk[] = [];

      await expect(async () => {
        for await (const chunk of recordStreamChunks(createErrorStream(), buffer)) {
          yieldedChunks.push(chunk);
        }
      }).rejects.toThrow('Network stream interrupted');

      expect(yieldedChunks).toEqual([
        {
          decodedData: new Uint8Array([10, 20]),
          sampleRate: 24000,
          mimeType: 'audio/l16',
        },
      ]);
      expect(buffer).toEqual([new Uint8Array([10, 20])]);
    });
  });
});
