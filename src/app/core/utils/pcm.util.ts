const AUDIO_NORMALIZATION_BASE = 32768.0;
const MIN_SAFETY_CLAMP = -1.0;
const MAX_SAFETY_CLAMP = 1.0;
const DEFAULT_GAIN = 1.0;

/**
 * Normalizes raw 16-bit linear PCM byte buffers (Uint8Array) into Float32Array samples
 * scaled between -1.0 and 1.0, ensuring safe even-byte boundaries.
 */
export function normalizePcmSamples(
  rawBytes: Uint8Array,
  gain = DEFAULT_GAIN,
): Float32Array<ArrayBuffer> {
  // Ensure even byte count for 16-bit PCM conversion
  const byteLength = rawBytes.byteLength % 2 === 0 ? rawBytes.byteLength : rawBytes.byteLength - 1;
  const int16Data = new Int16Array(rawBytes.buffer, rawBytes.byteOffset, byteLength / 2);
  const float32Data = new Float32Array(int16Data.length) as Float32Array<ArrayBuffer>;
  for (let i = 0; i < int16Data.length; i = i + 1) {
    const normalized = (int16Data[i] / AUDIO_NORMALIZATION_BASE) * gain;
    // Clamping safety threshold: limit to [-1.0, 1.0]
    float32Data[i] = Math.max(MIN_SAFETY_CLAMP, Math.min(MAX_SAFETY_CLAMP, normalized));
  }
  return float32Data;
}
