/* eslint-disable @typescript-eslint/no-magic-numbers */
import { DEFAULT_AUDIO_TYPE, DEFAULT_SAMPLE_RATE } from '@/core/constants/text-to-speech.constant';
import { RawAudioBinary } from '@/core/interfaces/text-to-speech.interface';
import { WavConversionOptions } from '@/shared/interfaces/wav-conversion-options.interface';

const AUDIO_NORMALIZATION_BASE = 32768.0;
const MIN_SAFETY_CLAMP = -1.0;
const MAX_SAFETY_CLAMP = 1.0;
const DEFAULT_GAIN = 1.0;
const RIFF_HEADER_SIZE = 44;

interface ParsedMimeType extends WavConversionOptions {
  baseType: string;
}

function isBlobPart(value: unknown): value is BlobPart {
  return (
    typeof value === 'string' || value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)
  );
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i = i + 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseBitsPerSample(baseType: string): number {
  const format = baseType.split('/')[1];
  if (format && format.toLowerCase().startsWith('l')) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      return bits;
    }
  }
  return 16;
}

function parseMimeType(mimeType: string): ParsedMimeType {
  const parts = mimeType.split(';');
  const baseType = parts[0]?.trim() || DEFAULT_AUDIO_TYPE;
  let sampleRate = DEFAULT_SAMPLE_RATE;
  let numChannels = 1;
  const bitsPerSample = parseBitsPerSample(baseType);

  for (const part of parts.slice(1)) {
    const [key, value] = part.split('=').map((s) => s.trim());
    if (key === 'rate') {
      sampleRate = parseInt(value, 10) || sampleRate;
    } else if (key === 'channels') {
      numChannels = parseInt(value, 10) || numChannels;
    }
  }

  return { baseType, sampleRate, numChannels, bitsPerSample };
}

function createWavHeader(dataLength: number, options: WavConversionOptions): Uint8Array {
  const { numChannels, sampleRate, bitsPerSample } = options;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const buffer = new ArrayBuffer(RIFF_HEADER_SIZE);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i = i + 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // ChunkID 'RIFF' (0x52, 0x49, 0x46, 0x46)
  writeString(0, 'RIFF');
  // ChunkSize: 36 + dataLength
  view.setUint32(4, 36 + dataLength, true);
  // Format 'WAVE' (0x57, 0x41, 0x56, 0x45)
  writeString(8, 'WAVE');
  // Subchunk1ID 'fmt '
  writeString(12, 'fmt ');
  // Subchunk1Size (16 for PCM)
  view.setUint32(16, 16, true);
  // AudioFormat (1 for PCM)
  view.setUint16(20, 1, true);
  // NumChannels
  view.setUint16(22, numChannels, true);
  // SampleRate
  view.setUint32(24, sampleRate, true);
  // ByteRate
  view.setUint32(28, byteRate, true);
  // BlockAlign
  view.setUint16(32, blockAlign, true);
  // BitsPerSample
  view.setUint16(34, bitsPerSample, true);
  // Subchunk2ID 'data'
  writeString(36, 'data');
  // Subchunk2Size
  view.setUint32(40, dataLength, true);

  return new Uint8Array(buffer);
}

/**
 * Normalizes raw 16-bit linear PCM byte buffers (Uint8Array) into Float32Array samples
 * scaled between -1.0 and 1.0, ensuring safe even-byte boundaries.
 */
export function normalizePcmSamples(rawBytes: Uint8Array, gain = DEFAULT_GAIN): Float32Array<ArrayBuffer> {
  const byteLength = rawBytes.byteLength % 2 === 0 ? rawBytes.byteLength : rawBytes.byteLength - 1;
  const int16Data = new Int16Array(rawBytes.buffer, rawBytes.byteOffset, byteLength / 2);
  const float32Data = new Float32Array(int16Data.length) as Float32Array<ArrayBuffer>;
  for (let i = 0; i < int16Data.length; i = i + 1) {
    const normalized = (int16Data[i] / AUDIO_NORMALIZATION_BASE) * gain;
    float32Data[i] = Math.max(MIN_SAFETY_CLAMP, Math.min(MAX_SAFETY_CLAMP, normalized));
  }
  return float32Data;
}

/**
 * Decodes a Gemini base64 audio chunk and extracts its sample rate.
 */
export function decodeAudioChunk(base64Data: string, mimeType?: string): RawAudioBinary {
  const decodedData = decodeBase64(base64Data);
  const sampleRate = mimeType ? parseMimeType(mimeType).sampleRate : DEFAULT_SAMPLE_RATE;
  return { decodedData, sampleRate };
}

/**
 * Converts Linear PCM bytes (or base64-encoded audio) into a playable audio/wav Blob with a 44-byte RIFF header.
 */
export function toWavBlob(rawData: Uint8Array | string, mimeType: string): Blob {
  const pcmBytes = typeof rawData === 'string' ? decodeBase64(rawData) : rawData;
  const options = parseMimeType(mimeType);
  const wavHeader = createWavHeader(pcmBytes.length, options);

  if (!isBlobPart(wavHeader) || !isBlobPart(pcmBytes)) {
    throw new Error('Header or raw data is not a valid BlobPart.');
  }

  return new Blob([wavHeader, pcmBytes], { type: 'audio/wav' });
}
