import { normalizePcmSamples } from './pcm.util';

describe('pcm.util', () => {
  it('should return empty Float32Array for empty Uint8Array', () => {
    const emptyInput = new Uint8Array(0);
    const result = normalizePcmSamples(emptyInput);
    expect(result.length).toBe(0);
  });

  it('should handle odd byte lengths by truncating the last byte', () => {
    // 3 bytes total, should truncate last byte and parse as 1 single 16-bit sample (2 bytes)
    const oddInput = new Uint8Array([0, 0, 123]);
    const result = normalizePcmSamples(oddInput);
    expect(result.length).toBe(1);
  });

  it('should correctly normalize signed 16-bit integer PCM values to floats', () => {
    // Little-endian values
    // Sample 1: 0 (0x0000) -> 0.0
    // Sample 2: 16384 (0x0040) -> 0.5 (16384 / 32768)
    // Sample 3: -32768 (0x0080) -> -1.0 (-32768 / 32768)
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

    // Scale by 2.0 gain:
    // Sample 0.5 * 2 = 1.0
    // Sample -0.75 * 2 = -1.5 (should clamp to -1.0)
    const result = normalizePcmSamples(u8Input, 2.0);

    expect(result.length).toBe(2);
    expect(result[0]).toBeCloseTo(1.0, 5);
    expect(result[1]).toBeCloseTo(-1.0, 5); // Clamped successfully!
  });
});
